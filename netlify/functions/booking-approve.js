const { requireApprover, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    const user = await requireApprover(event);
    const { id } = event.queryStringParameters || {};
    const body = JSON.parse(event.body || '{}');

    await db.runTransaction(async (tx) => {
      const bookingRef = db.collection('bookings').doc(id);
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new HttpError(404, 'ไม่พบการจอง');
      const booking = bookingSnap.data();
      if (booking.status !== 'pending') {
        throw new HttpError(400, 'การจองนี้ไม่อยู่ในสถานะ pending');
      }

      const reqSnap = await tx.get(db.collection('chemical_requests').where('booking_id', '==', id));
      const invRefs = reqSnap.docs.map((d) => db.collection('chemical_inventory').doc(d.data().chemical_id));
      const invSnaps = await Promise.all(invRefs.map((ref) => tx.get(ref)));

      for (let i = 0; i < reqSnap.docs.length; i++) {
        const reqData = reqSnap.docs[i].data();
        const invSnap = invSnaps[i];
        const inv = invSnap.exists ? invSnap.data() : null;
        if (!inv || inv.current_stock < reqData.requested_qty) {
          throw new HttpError(400, `สต็อกไม่พอสำหรับ ${inv ? inv.name : reqData.chemical_id}`);
        }
      }

      tx.update(bookingRef, { status: 'approved' });
      const logRef = db.collection('approval_log').doc();
      tx.set(logRef, {
        booking_id: id,
        approver_id: user.id,
        action: 'approved',
        comment: body.comment || '',
        created_at: new Date().toISOString(),
      });
    });

    const updated = await db.collection('bookings').doc(id).get();
    return json(200, { booking: { id: updated.id, ...updated.data() } });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    console.error('booking-approve error:', err.stack || err);
    return json(500, { error: err.message });
  }
};
