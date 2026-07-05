const { schedule } = require('@netlify/functions');
const { autoCompleteOverdueBookings } = require('./_lib/autoComplete');

// Runs every 15 minutes so overdue 'approved' bookings get completed even if
// nobody has the app open (the same check also runs on every GET /api/bookings
// for near-instant completion while the app is in active use).
exports.handler = schedule('*/15 * * * *', async () => {
  try {
    const count = await autoCompleteOverdueBookings();
    console.log(`scheduled-auto-complete: completed ${count} overdue booking(s)`);
  } catch (err) {
    console.error('scheduled-auto-complete error:', err.stack || err);
  }
  return { statusCode: 200 };
});
