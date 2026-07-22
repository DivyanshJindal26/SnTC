import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

// Lets the admin page verify the signed-in user before showing the panel
router.get('/me', (req, res) => {
  res.json({ admin: true, email: req.user.email, name: req.user.name });
});

// --- sessions CRUD ---

router.post('/sessions', (req, res) => {
  const { title, description, starts_at, venue, capacity } = req.body;
  if (!title || !starts_at || !venue) {
    return res.status(400).json({ error: 'title, starts_at, and venue required' });
  }

  const result = db.prepare(`
    INSERT INTO sessions (title, description, starts_at, venue, capacity)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, description || null, starts_at, venue, capacity || 300);

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(session);
});

router.put('/sessions/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Session not found' });

  const {
    title = existing.title,
    description = existing.description,
    starts_at = existing.starts_at,
    venue = existing.venue,
    capacity = existing.capacity,
    registration_open = existing.registration_open,
  } = req.body;

  db.prepare(`
    UPDATE sessions
    SET title = ?, description = ?, starts_at = ?, venue = ?, capacity = ?, registration_open = ?
    WHERE id = ?
  `).run(title, description, starts_at, venue, capacity, registration_open ? 1 : 0, req.params.id);

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  res.json(session);
});

router.delete('/sessions/:id', (req, res) => {
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });
  res.json({ success: true });
});

// --- registrations management ---

router.get('/sessions/:id/registrations', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const registrations = db.prepare(`
    SELECT * FROM registrations WHERE session_id = ? ORDER BY registered_at ASC
  `).all(req.params.id);

  res.json({ session, registrations, count: registrations.length });
});

router.put('/registrations/:id/checkin', (req, res) => {
  const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Registration not found' });

  const newState = reg.checked_in ? 0 : 1;
  db.prepare(`
    UPDATE registrations SET checked_in = ?, checked_in_at = ? WHERE id = ?
  `).run(newState, newState ? new Date().toISOString() : null, req.params.id);

  const updated = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.get('/sessions/:id/export', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const registrations = db.prepare(`
    SELECT name, email, roll_number, registered_at, checked_in, checked_in_at
    FROM registrations WHERE session_id = ? ORDER BY registered_at ASC
  `).all(req.params.id);

  const header = 'Name,Email,Roll Number,Registered At,Checked In,Checked In At';
  const rows = registrations.map(r =>
    [r.name, r.email, r.roll_number || '', r.registered_at, r.checked_in ? 'Yes' : 'No', r.checked_in_at || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${session.title.replace(/[^a-zA-Z0-9]/g, '_')}_registrations.csv"`);
  res.send(csv);
});

export default router;
