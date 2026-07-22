import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id) AS registration_count
    FROM sessions s
    ORDER BY s.starts_at ASC
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id) AS registration_count
    FROM sessions s
    WHERE s.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Session not found' });
  res.json(row);
});

export default router;
