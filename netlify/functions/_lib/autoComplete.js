const { db } = require('./firebaseAdmin');

// Any 'approved' booking whose end_dt has already passed gets auto-completed:
// actual_used_qty defaults to the originally requested_qty (nobody logged real
// usage), stock is deducted accordingly, same as a manual "complete" action.
async function autoCompleteOverdueBookings() {
  const now = new Date().toISOString();
  const snap = await db.collection('bookings').where('status', '==', 'approved').get();
  const overdue = snap.docs.filter((d) => d.data().end_dt < now);

  let completed = 0;
  for (const bookingDoc of overdue) {
    const bookingId = bookingDoc.id;
    try {
      await db.runTransaction(async (tx) => {
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingSnap = await tx.get(bookingRef);
        if (!bookingSnap.exists || bookingSnap.data().status !== 'approved') return;

        const reqSnap = await tx.get(db.collection('chemical_requests').where('booking_id', '==', bookingId));
        const invRefs = reqSnap.docs.map((d) => db.collection('chemical_inventory').doc(d.data().chemical_id));
        const invSnaps = await Promise.all(invRefs.map((ref) => tx.get(ref)));

        for (let i = 0; i < reqSnap.docs.length; i++) {
          const reqDoc = reqSnap.docs[i];
          const reqData = reqDoc.data();
          const invSnap = invSnaps[i];
          if (!invSnap.exists) continue;
          const qty = reqData.requested_qty;
          tx.update(invRefs[i], { current_stock: invSnap.data().current_stock - qty });
          tx.update(reqDoc.ref, { actual_used_qty: qty });
        }

        tx.update(bookingRef, { status: 'completed' });
      });
      completed++;
    } catch (err) {
      console.error('autoCompleteOverdueBookings failed for booking', bookingId, err.stack || err);
    }
  }
  return completed;
}

module.exports = { autoCompleteOverdueBookings };
