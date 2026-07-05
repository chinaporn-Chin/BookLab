const { requireLogin, requireApprover, HttpError, json, db } = require('./_lib/auth');

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9฀-๿]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function listInventory() {
  const snap = await db.collection('chemical_inventory').get();
  const inventory = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((i) => ({ ...i, low_stock: i.current_stock < i.min_threshold }));
  return json(200, { inventory });
}

async function upsertChemical({ name, unit, current_stock, min_threshold }) {
  const id = slugify(name);
  if (!id) throw new HttpError(400, 'ชื่อสารเคมีไม่ถูกต้อง');
  await db.collection('chemical_inventory').doc(id).set(
    {
      name,
      unit: unit || '',
      current_stock: Number(current_stock) || 0,
      min_threshold: Number(min_threshold) || 0,
    },
    { merge: true }
  );
  return id;
}

async function importChemicals(items) {
  const ids = [];
  for (const item of items) {
    if (!item || !item.name) continue;
    ids.push(await upsertChemical(item));
  }
  return json(201, { imported: ids.length });
}

async function createChemical(body) {
  const { name, unit, current_stock, min_threshold } = body;
  if (!name) return json(400, { error: 'ชื่อสารเคมีจำเป็น' });

  const id = slugify(name);
  if (!id) return json(400, { error: 'ชื่อสารเคมีไม่ถูกต้อง' });

  const existing = await db.collection('chemical_inventory').doc(id).get();
  if (existing.exists) {
    return json(409, { error: 'มีสารเคมีชื่อนี้อยู่แล้ว' });
  }

  await upsertChemical({ name, unit, current_stock, min_threshold });
  const created = await db.collection('chemical_inventory').doc(id).get();
  return json(201, { item: { id: created.id, ...created.data() } });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      await requireLogin(event);
      return await listInventory();
    }
    if (event.httpMethod === 'POST') {
      await requireApprover(event);
      const body = JSON.parse(event.body || '{}');
      if (Array.isArray(body.items)) return await importChemicals(body.items);
      return await createChemical(body);
    }
    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    console.error('inventory error:', err.stack || err);
    return json(500, { error: err.message });
  }
};
