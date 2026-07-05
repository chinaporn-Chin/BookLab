const { requireApprover, idFromPath, HttpError, json, db } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await requireApprover(event);
    const id = idFromPath(event, 1);
    const { current_stock, min_threshold } = JSON.parse(event.body || '{}');

    const itemRef = db.collection('chemical_inventory').doc(id);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) return json(404, { error: 'ไม่พบสารเคมี' });
    const item = itemSnap.data();

    await itemRef.update({
      current_stock: current_stock !== undefined ? current_stock : item.current_stock,
      min_threshold: min_threshold !== undefined ? min_threshold : item.min_threshold,
    });

    const updated = await itemRef.get();
    return json(200, { item: { id: updated.id, ...updated.data() } });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    console.error('inventory-item error:', err.stack || err);
    return json(500, { error: err.message });
  }
};
