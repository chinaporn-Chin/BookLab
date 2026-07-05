const { requireLogin, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await requireLogin(event);
    const { id } = event.queryStringParameters || {};
    const { actual_usage } = JSON.parse(event.body || '{}'); // [{ chemical_id, actual_used_qty }]

    await db.runTransaction(async (tx) => {
      const bookingRef = db.collection('bookings').doc(id);
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new HttpError(404, 'ไม่พบการจอง');
      const booking = bookingSnap.data();
      if (booking.status !== 'approved') {
        throw new HttpError(400, 'การจองนี้ต้องถูก approve ก่อนถึงจะ complete ได้');
      }

      const usage = Array.isArray(actual_usage) ? actual_usage : [];

      const reqSnap = await tx.get(db.collection('chemical_requests').where('booking_id', '==', id));
      const reqDocByChemId = {};
      reqSnap.docs.forEach((d) => {
        reqDocByChemId[d.data().chemical_id] = d.ref;
      });

      const invRefs = usage.map((u) => db.collection('chemical_inventory').doc(u.chemical_id));
      const invSnaps = await Promise.all(invRefs.map((ref) => tx.get(ref)));

      for (let i = 0; i < usage.length; i++) {
        const u = usage[i];
        const invRef = invRefs[i];
        const invSnap = invSnaps[i];
        if (!invSnap.exists) continue;
        const newStock = invSnap.data().current_stock - Number(u.actual_used_qty);
        tx.update(invRef, { current_stock: newStock });

        const reqRef = reqDocByChemId[u.chemical_id];
        if (reqRef) tx.update(reqRef, { actual_used_qty: Number(u.actual_used_qty) });
      }

      tx.update(bookingRef, { status: 'completed' });
    });

    const updated = await db.collection('bookings').doc(id).get();
    return json(200, { booking: { id: updated.id, ...updated.data() } });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    return json(500, { error: err.message });
  }
};
