const { requireLogin, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await requireLogin(event);
    const { month } = event.queryStringParameters || {};
    const m = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);

    const bookingsSnap = await db.collection('bookings').where('status', '==', 'completed').get();
    const bookings = bookingsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((b) => b.start_dt.slice(0, 7) === m);
    const bookingIds = new Set(bookings.map((b) => b.id));
    const bookingById = Object.fromEntries(bookings.map((b) => [b.id, b]));

    const reqSnap = await db.collection('chemical_requests').get();
    const requests = reqSnap.docs
      .map((d) => d.data())
      .filter((r) => bookingIds.has(r.booking_id) && r.actual_used_qty != null);

    const chemIds = [...new Set(requests.map((r) => r.chemical_id))];
    const chemDocs = await Promise.all(chemIds.map((cid) => db.collection('chemical_inventory').doc(cid).get()));
    const chemById = {};
    chemDocs.forEach((snap) => {
      if (snap.exists) chemById[snap.id] = snap.data();
    });

    // group by user_id + chemical_id
    const groups = {};
    for (const r of requests) {
      const booking = bookingById[r.booking_id];
      const key = `${booking.user_id}::${r.chemical_id}`;
      if (!groups[key]) {
        groups[key] = {
          user_name: booking.user_name,
          chemical_name: chemById[r.chemical_id] ? chemById[r.chemical_id].name : r.chemical_id,
          unit: chemById[r.chemical_id] ? chemById[r.chemical_id].unit : '',
          total_used: 0,
          booking_ids: new Set(),
        };
      }
      groups[key].total_used += r.actual_used_qty;
      groups[key].booking_ids.add(r.booking_id);
    }

    const rows = Object.values(groups)
      .map((g) => ({
        user_name: g.user_name,
        chemical_name: g.chemical_name,
        unit: g.unit,
        total_used: g.total_used,
        booking_count: g.booking_ids.size,
      }))
      .sort((a, b) => a.user_name.localeCompare(b.user_name) || a.chemical_name.localeCompare(b.chemical_name));

    return json(200, { month: m, rows });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    return json(500, { error: err.message });
  }
};
