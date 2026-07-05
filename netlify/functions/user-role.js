const { requireApprover, idFromPath, HttpError, json, db } = require('./_lib/auth');

const VALID_ROLES = ['researcher', 'approver'];

exports.handler = async (event) => {
  try {
    const requester = await requireApprover(event);
    const id = idFromPath(event, 2);
    const { role } = JSON.parse(event.body || '{}');

    if (!VALID_ROLES.includes(role)) {
      return json(400, { error: 'role ต้องเป็น researcher หรือ approver' });
    }
    if (id === requester.id && role !== 'approver') {
      return json(400, { error: 'ไม่สามารถลดสิทธิ์ตัวเองได้' });
    }

    const userRef = db.collection('users').doc(id);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return json(404, { error: 'ไม่พบผู้ใช้งาน' });

    await userRef.update({ role });

    const updated = await userRef.get();
    return json(200, { user: { id: updated.id, ...updated.data() } });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
    return json(500, { error: err.message });
  }
};
