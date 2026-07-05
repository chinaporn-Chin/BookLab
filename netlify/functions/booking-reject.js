const { requireApprover, idFromPath, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    const user = await requireApprover(event);
    const id = idFromPath(event, 2);
    const { comment } = JSON.parse(event.body || '{}');

    const bookingRef = db.collection('bookings').doc(id);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) return json(404, { error: 'ไม่พบการจอง' });
    const booking = bookingSnap.data();
    if (booking.status !== 'pending') {
      return json(400, { error: 'การจองนี้ไม่อยู่ในสถานะ pending' });
    }

    const batch = db.batch();
    batch.update(bookingRef, { status: 'rejected' });
    const logRef = db.collection('approval_log').doc();
    batch.set(logRef, {
      booking_id: id,
      approver_id: user.id,
      action: 'rejected',
      comment: comment || '',
      created_at: new Date().toISOString(),
    });
    await batch.commit();

    const updated = await bookingRef.get();
    return json(200, { booking: { id: updated.id, ...updated.data() } });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    return json(500, { error: err.message });
  }
};
