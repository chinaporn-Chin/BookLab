const { admin, db } = require('./firebaseAdmin');

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// Netlify's `to = "/.netlify/functions/x?id=:id"` redirect substitution does
// not populate event.queryStringParameters, so dynamic path segments are
// parsed directly from the real incoming path (event.path) instead.
// positionFromEnd=1 -> last segment (e.g. /api/inventory/:id)
// positionFromEnd=2 -> second-to-last (e.g. /api/bookings/:id/approve)
function idFromPath(event, positionFromEnd = 1) {
  const segments = event.path.split('/').filter(Boolean);
  const raw = segments[segments.length - positionFromEnd] || '';
  return decodeURIComponent(raw);
}

function getApproverEmails() {
  return (process.env.APPROVER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Verifies the bearer token and returns { id, name, email, role }, creating the
// users/{uid} doc on first login (role defaults to researcher, or approver if
// the email is listed in APPROVER_EMAILS).
async function getUser(event) {
  const header = event.headers.authorization || event.headers.Authorization;
  if (!header || !header.startsWith('Bearer ')) return null;

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(header.slice(7));
  } catch {
    return null;
  }

  const userRef = db.collection('users').doc(decoded.uid);
  const snap = await userRef.get();
  if (snap.exists) {
    return { id: decoded.uid, ...snap.data() };
  }

  const role = getApproverEmails().includes((decoded.email || '').toLowerCase())
    ? 'approver'
    : 'researcher';
  const newUser = {
    name: decoded.name || decoded.email || 'Unknown',
    email: decoded.email || '',
    role,
    created_at: new Date().toISOString(),
  };
  await userRef.set(newUser);
  return { id: decoded.uid, ...newUser };
}

async function requireLogin(event) {
  const user = await getUser(event);
  if (!user) throw new HttpError(401, 'Unauthorized: please login');
  return user;
}

async function requireApprover(event) {
  const user = await requireLogin(event);
  if (user.role !== 'approver') throw new HttpError(403, 'Forbidden: approver role required');
  return user;
}

module.exports = { getUser, requireLogin, requireApprover, idFromPath, HttpError, json, db, admin };
