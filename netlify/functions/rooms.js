const { requireLogin, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await requireLogin(event);
    const snap = await db.collection('rooms').get();
    const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return json(200, { rooms });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    return json(500, { error: err.message });
  }
};
