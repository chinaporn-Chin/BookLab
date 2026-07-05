const { requireApprover, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await requireApprover(event);
    const snap = await db.collection('users').get();
    const users = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json(200, { users });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    return json(500, { error: err.message });
  }
};
