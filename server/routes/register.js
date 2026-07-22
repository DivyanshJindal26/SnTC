import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { signCheckinToken, generateQRDataUrl, generateQRBuffer } from '../lib/qr.js';
import { sendRegistrationEmail } from '../lib/email.js';

const router = Router();
const siteUrl = process.env.SITE_URL || 'https://sntc.iitmandi.co.in';

router.get('/:id/my-registration', requireAuth, async (req, res) => {
  const row = db.prepare(
    'SELECT * FROM registrations WHERE session_id = ? AND firebase_uid = ?'
  ).get(req.params.id, req.user.uid);

  if (!row) return res.json({ registered: false, registration: null });

  const token = signCheckinToken(row.id, row.session_id);
  const qr = await generateQRDataUrl(token);

  res.json({ registered: true, registration: row, qr });
});

router.post('/:id/register', requireAuth, async (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.registration_open) return res.status(400).json({ error: 'Registration closed' });

  const count = db.prepare(
    'SELECT COUNT(*) AS c FROM registrations WHERE session_id = ?'
  ).get(req.params.id).c;

  if (count >= session.capacity) {
    return res.status(400).json({ error: 'Session full' });
  }

  const existing = db.prepare(
    'SELECT id FROM registrations WHERE session_id = ? AND firebase_uid = ?'
  ).get(req.params.id, req.user.uid);

  if (existing) return res.status(400).json({ error: 'Already registered' });

  const rollNumber = req.body.roll_number || null;

  const result = db.prepare(`
    INSERT INTO registrations (session_id, firebase_uid, name, email, roll_number)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, req.user.uid, req.user.name, req.user.email, rollNumber);

  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(result.lastInsertRowid);

  // Generate QR
  const qrToken = signCheckinToken(registration.id, registration.session_id);
  const qr = await generateQRDataUrl(qrToken);

  // Send confirmation email (fire-and-forget — don't block response)
  const qrBuffer = await generateQRBuffer(qrToken);
  sendRegistrationEmail({
    to: req.user.email,
    studentName: req.user.name,
    sessionTitle: session.title,
    sessionDate: session.starts_at,
    venue: session.venue,
    qrBuffer,
    siteUrl,
  }).catch(err => console.error('[email] Failed to send:', err.message));

  res.status(201).json({ registration, qr });
});

router.delete('/:id/register', requireAuth, (req, res) => {
  const result = db.prepare(
    'DELETE FROM registrations WHERE session_id = ? AND firebase_uid = ?'
  ).run(req.params.id, req.user.uid);

  if (result.changes === 0) return res.status(404).json({ error: 'Not registered' });
  res.json({ success: true });
});

export default router;
