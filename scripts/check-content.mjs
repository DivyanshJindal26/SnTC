/**
 * Content integrity check. Runs in CI on every PR.
 *
 * Astro's Zod schemas catch wrong types, missing fields and unknown keys, but
 * `reference()` does NOT verify that the referenced entry actually exists —
 * a typo like `host: ecel` passes `astro build` with exit code 0 and silently
 * drops the club link. This script closes that gap.
 *
 * It also enforces the two content rules the schema cannot express:
 *   - no roll numbers anywhere in member-facing strings
 *   - every event date carries a year (the old site's "14th September" bug)
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const problems = [];
const fail = (file, msg) => problems.push({ file, msg });

/** recursively list files under dir matching ext */
const walk = async (dir, ext) => {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, ext)));
    else if (e.name.endsWith(ext)) out.push(full);
  }
  return out;
};

/** id is the path below `base`, without extension, posix-separated */
const idOf = (file, base) =>
  path.relative(base, file).replace(/\\/g, '/').replace(/\.(md|yaml)$/, '');

const frontmatter = (raw, file) => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) {
    fail(file, 'no frontmatter block found');
    return null;
  }
  try {
    return parse(m[1]) ?? {};
  } catch (e) {
    fail(file, `YAML parse error: ${e.message}`);
    return null;
  }
};

const load = async (dir, ext, base) => {
  const files = await walk(dir, ext);
  const map = new Map();
  for (const f of files) {
    if (path.basename(f).startsWith('_')) continue;
    const raw = await readFile(f, 'utf8');
    const data = ext === '.md' ? frontmatter(raw, f) : parse(raw);
    if (data) map.set(idOf(f, base), { file: f, data, raw });
  }
  return map;
};

const groups = await load('src/content/groups', '.md', 'src/content/groups');
const events = await load('src/content/events', '.md', 'src/content/events');
const projects = await load('src/content/projects', '.md', 'src/content/projects');
const members = await load('src/data/members', '.yaml', 'src/data/members');
const interiit = await load('src/data/interiit', '.yaml', 'src/data/interiit');

/** verify a reference field points at something real */
const ref = (entry, field, value, target, targetName) => {
  if (value === undefined || value === null) return;
  const id = typeof value === 'object' ? value.id : value;
  if (!target.has(String(id))) {
    const near = [...target.keys()].filter((k) => k.startsWith(String(id).slice(0, 3)));
    fail(
      entry.file,
      `${field}: "${id}" is not a ${targetName}.` +
        (near.length ? ` Did you mean: ${near.join(', ')}?` : ` Known: ${[...target.keys()].join(', ')}`),
    );
  }
};

// --- references ------------------------------------------------------------
for (const [, e] of events) {
  ref(e, 'host', e.data.host, groups, 'group');
  ref(e, 'parent', e.data.parent, events, 'event');
  if (e.data.parent && idOf(e.file, 'src/content/events') === String(e.data.parent)) {
    fail(e.file, 'parent points at itself');
  }
}
for (const [, p] of projects) {
  ref(p, 'group', p.data.group, groups, 'group');
  for (const who of [p.data.lead, p.data.coLead, ...(p.data.team ?? [])]) {
    if (who?.member) ref(p, `team member "${who.name}"`, who.member, members, 'member');
  }
}
for (const [, m] of members) {
  for (const g of m.data.groups ?? []) ref(m, 'groups', g, groups, 'group');
}

// --- image paths -----------------------------------------------------------
// Astro fails the whole build on one missing image, and the migration writes
// .jpg or .png depending on whether the source had real transparency. Catch
// the mismatch here, where the message names the file.
const IMAGE_FIELDS = ['logo', 'photo', 'poster', 'image'];
for (const [, entry] of [...groups, ...members, ...events, ...projects, ...interiit]) {
  for (const field of IMAGE_FIELDS) {
    const rel = entry.data?.[field];
    if (typeof rel !== 'string') continue;
    const resolved = path.resolve(path.dirname(entry.file), rel);
    if (!existsSync(resolved)) {
      const dir = path.dirname(resolved);
      const stem = path.basename(resolved).replace(/\.[^.]+$/, '');
      const alt = existsSync(dir)
        ? readdirSync(dir).find((f) => f.replace(/\.[^.]+$/, '') === stem)
        : null;
      fail(
        entry.file,
        `${field}: "${rel}" does not exist.` +
          (alt ? ` Did you mean "${path.basename(rel).replace(/[^.]+$/, '')}${alt.split('.').pop()}"?` : ''),
      );
    }
  }
}

// --- roll numbers ----------------------------------------------------------
// Matches the institute's format: a letter then 5 digits, e.g. b22136, B16001.
const ROLL = /\b[bBtT]\d{5}\b/;
for (const [, entry] of [...members, ...interiit, ...events, ...projects]) {
  const hit = entry.raw.match(ROLL);
  if (hit) fail(entry.file, `looks like a roll number: "${hit[0]}" — publish names only`);
}

// --- event dates must carry a year ----------------------------------------
for (const [id, e] of events) {
  const d = e.data.startDate;
  if (d === undefined) {
    fail(e.file, 'startDate is required');
    continue;
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(d instanceof Date ? d.toISOString() : d))) {
    fail(e.file, `startDate "${d}" must be a full ISO date with a year, e.g. 2026-09-14`);
  }
  // a sub-event should sit inside its parent's window
  const parent = e.data.parent ? events.get(String(e.data.parent)) : null;
  if (parent?.data.startDate && parent?.data.endDate) {
    const t = new Date(e.data.startDate).getTime();
    const lo = new Date(parent.data.startDate).getTime();
    const hi = new Date(parent.data.endDate).getTime() + 86_400_000 - 1;
    if (t < lo || t > hi) {
      fail(e.file, `startDate falls outside ${id.split('/')[0]}'s dates`);
    }
  }
}

// --- report ----------------------------------------------------------------
const counts = `groups ${groups.size} · members ${members.size} · events ${events.size} · projects ${projects.size} · inter-iit ${interiit.size}`;

if (problems.length === 0) {
  console.log(`Content OK — ${counts}`);
  process.exit(0);
}

console.error(`\n${problems.length} content problem(s):\n`);
for (const p of problems) {
  console.error(`  ${path.relative(process.cwd(), p.file)}`);
  console.error(`    ${p.msg}\n`);
}
console.error(`(${counts})`);
process.exit(1);
