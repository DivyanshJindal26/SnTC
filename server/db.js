import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'sntc.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    description   TEXT,
    starts_at     TEXT    NOT NULL,
    venue         TEXT    NOT NULL,
    capacity      INTEGER NOT NULL DEFAULT 300,
    registration_open INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    firebase_uid  TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL,
    roll_number   TEXT,
    registered_at TEXT    NOT NULL DEFAULT (datetime('now')),
    checked_in    INTEGER NOT NULL DEFAULT 0,
    checked_in_at TEXT,
    UNIQUE(session_id, firebase_uid)
  );
`);

export default db;
