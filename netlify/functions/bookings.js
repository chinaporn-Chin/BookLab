const { requireLogin, HttpError, json, db } = require('./_lib/auth');

async function listBookings(event) {
  const { room_id, date } = event.queryStringParameters || {};

  let query = db.collection('bookings');
  if (room_id) query = query.where('room_id', '==', room_id);
  const snap = await query.get();

  let bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (date) {
    bookings = bookings.filter((b) => b.start_dt.slice(0, 10) === date);
  }
  bookings.sort((a, b) => a.start_dt.localeCompare(b.start_dt));

  return json(200, { bookings });
}

async function createBooking(event, user) {
  const body = JSON.parse(event.body || '{}');
  const { room_id, start_dt, end_dt, purpose, chemicals } = body;

  if (!room_id || !start_dt || !end_dt) {
    return json(400, { error: 'room_id, start_dt, end_dt จำเป็น' });
  }
  if (new Date(start_dt) >= new Date(end_dt)) {
    return json(400, { error: 'start_dt ต้องมาก่อน end_dt' });
  }

  // ต้องจองล่วงหน้าอย่างน้อย 2 วัน (ห้ามจองวันนี้หรือพรุ่งนี้)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 2);
  const bookingDate = new Date(start_dt);
  bookingDate.setHours(0, 0, 0, 0);
  if (bookingDate < minDate) {
    return json(400, {
      error: `ต้องจองล่วงหน้าอย่างน้อย 2 วัน (จองได้ตั้งแต่ ${minDate.toLocaleDateString('th-TH')} เป็นต้นไป)`,
    });
  }

  const roomSnap = await db.collection('rooms').doc(room_id).get();
  if (!roomSnap.exists) return json(400, { error: 'ไม่พบห้องที่เลือก' });
  const room = roomSnap.data();

  // Conflict check: ห้ามจองห้องเดิมซ้อนเวลาเดียวกัน (เฉพาะที่ยัง pending/approved)
  const roomBookingsSnap = await db.collection('bookings').where('room_id', '==', room_id).get();
  const conflict = roomBookingsSnap.docs.some((d) => {
    const b = d.data();
    return (
      (b.status === 'pending' || b.status === 'approved') &&
      b.start_dt < end_dt &&
      b.end_dt > start_dt
    );
  });
  if (conflict) {
    return json(409, { error: 'ห้องนี้ถูกจองในช่วงเวลานี้แล้ว' });
  }

  const bookingRef = db.collection('bookings').doc();
  const booking = {
    user_id: user.id,
    user_name: user.name,
    room_id,
    room_name: room.name,
    start_dt,
    end_dt,
    purpose: purpose || '',
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  await bookingRef.set(booking);

  if (Array.isArray(chemicals)) {
    const batch = db.batch();
    for (const c of chemicals) {
      if (c.chemical_id && c.requested_qty) {
        const reqRef = db.collection('chemical_requests').doc();
        batch.set(reqRef, {
          booking_id: bookingRef.id,
          chemical_id: c.chemical_id,
          requested_qty: c.requested_qty,
          actual_used_qty: null,
        });
      }
    }
    await batch.commit();
  }

  return json(201, { booking: { id: bookingRef.id, ...booking } });
}

exports.handler = async (event) => {
  try {
    const user = await requireLogin(event);
    if (event.httpMethod === 'GET') return await listBookings(event);
    if (event.httpMethod === 'POST') return await createBooking(event, user);
    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    console.error('bookings error:', err.stack || err);
    return json(500, { error: err.message });
  }
};
