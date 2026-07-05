const { requireLogin, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await requireLogin(event);
    const snap = await db.collection('chemical_inventory').get();
    const inventory = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => ({ ...i, low_stock: i.current_stock < i.min_threshold }));
    return json(200, { inventory });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    return json(500, { error: err.message });
  }
};
