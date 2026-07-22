import { Router } from 'express';
import db from '../db.js';
import { verifyCheckinToken } from '../lib/qr.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/scan', requireAdmin, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing QR token' });

  let payload;
  try {
    payload = verifyCheckinToken(token);
  } catch {
    return res.status(400).json({ error: 'Invalid or tampered QR code' });
  }

  const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(payload.rid);
  if (!reg) return res.status(404).json({ error: 'Registration not found' });
  if (reg.session_id !== payload.sid) {
    return res.status(400).json({ error: 'QR code is for a different session' });
  }

  if (reg.checked_in) {
    return res.json({
      already_checked_in: true,
      student: { name: reg.name, email: reg.email, roll_number: reg.roll_number },
      checked_in_at: reg.checked_in_at,
    });
  }

  db.prepare(
    'UPDATE registrations SET checked_in = 1, checked_in_at = ? WHERE id = ?'
  ).run(new Date().toISOString(), reg.id);

  res.json({
    success: true,
    student: { name: reg.name, email: reg.email, roll_number: reg.roll_number },
  });
});

export default router;
