const { requireLogin, idFromPath, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await requireLogin(event);
    const id = idFromPath(event, 2);

    const bookingSnap = await db.collection('bookings').doc(id).get();
    if (!bookingSnap.exists) return json(404, { error: 'ไม่พบการจอง' });
    const booking = { id: bookingSnap.id, ...bookingSnap.data() };

    const reqSnap = await db.collection('chemical_requests').where('booking_id', '==', id).get();
    const chemIds = [...new Set(reqSnap.docs.map((d) => d.data().chemical_id))];
    const chemDocs = await Promise.all(chemIds.map((cid) => db.collection('chemical_inventory').doc(cid).get()));
    const chemById = {};
    chemDocs.forEach((snap) => {
      if (snap.exists) chemById[snap.id] = snap.data();
    });

    const requests = reqSnap.docs.map((d) => {
      const r = d.data();
      const chem = chemById[r.chemical_id];
      return {
        chemical_id: r.chemical_id,
        requested_qty: r.requested_qty,
        actual_used_qty: r.actual_used_qty,
        chemical_name: chem ? chem.name : r.chemical_id,
        unit: chem ? chem.unit : '',
      };
    });

    return json(200, { booking, requests });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    console.error('booking-requests error:', err.stack || err);
    return json(500, { error: err.message });
  }
};
