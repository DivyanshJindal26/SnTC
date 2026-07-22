import admin from 'firebase-admin';

const allowedDomains = (process.env.ALLOWED_DOMAINS || 'iitmandi.ac.in,students.iitmandi.ac.in')
  .split(',')
  .map(d => d.trim());

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

function getDomain(email) {
  return email.split('@')[1]?.toLowerCase();
}

export async function requireAuth(req, res, next) {
  let header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') && req.query.token) {
    header = `Bearer ${req.query.token}`;
  }
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const token = header.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);

    if (!decoded.email) {
      return res.status(403).json({ error: 'No email in token' });
    }

    const domain = getDomain(decoded.email);
    if (!allowedDomains.includes(domain)) {
      return res.status(403).json({ error: 'Only IIT Mandi emails allowed' });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email.split('@')[0],
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
}

export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.user) return;

    if (!adminEmails.includes(req.user.email.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}
