/**
 * One-time migration: old `images/` -> `src/assets/`.
 *
 * Takes the ORIGINAL jpg/png only — never the files in `images/webp/`, which
 * are hand-made lossy re-encodes. Re-encoding those would compound artefacts,
 * and several of them are already broken (RCManish.webp is larger than its
 * jpg; Yogesh.webp is still 2 MB).
 *
 * Astro handles per-breakpoint avif/webp at build time. This script only has
 * to get the sources to a sane resolution and filename.
 *
 * Run once:  npm run optimize-images
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'images';
const OUT = 'src/assets';

/** long-edge caps — portraits are rendered small, posters get opened */
const PROFILE = { dir: 'people', max: 1000 };
const POSTER = { dir: 'events', max: 1400 };
const GROUP = { dir: 'groups', max: 512 };
const PROJECT = { dir: 'projects', max: 1400 };
const BRAND = { dir: 'brand', max: 512 };
const INTERIIT = { dir: 'interiit', max: 1400 };

/** source filename -> [target group, output stem] */
const MAP = {
  // --- people (18 core members) -------------------------------------------
  'vaibhav.jpg': [PROFILE, 'vaibhav-kesharwani'],
  'Aditya.jpg': [PROFILE, 'aditya-sahu'],
  'Aritra.jpg': [PROFILE, 'aritra-boral'],
  'Himadri.jpg': [PROFILE, 'himadri-singh'],
  'Vinamra.jpg': [PROFILE, 'vinamra-garg'],
  'Anhad.jpg': [PROFILE, 'anhad-thakral'],
  'Shubhum.png': [PROFILE, 'shubham-padhi'],
  'Diksha.jpg': [PROFILE, 'diksha-sharma'],
  'Dhruv.jpg': [PROFILE, 'dhruv-verma'],
  'Rohith.jpg': [PROFILE, 'rohith-pranav'],
  'Tharun.jpg': [PROFILE, 'tharun-chanda'],
  'Kusum.jpg': [PROFILE, 'kusum-agrawal'],
  'Manan.jpg': [PROFILE, 'manan'],
  'Yogesh.jpg': [PROFILE, 'yogesh'],
  'Ayush.jpg': [PROFILE, 'ayush-sawarn'],
  'RCManish.jpg': [PROFILE, 'rc-manish-reddy'],
  'Mayank.jpg': [PROFILE, 'mayank-goel'],
  'Piyush.jpg': [PROFILE, 'piyush-kumar'],

  // --- group logos ---------------------------------------------------------
  'programming.png': [GROUP, 'programming-club'],
  'robotronics.png': [GROUP, 'robotronics'],
  'ecell.png': [GROUP, 'ecell'],
  'yantrik.png': [GROUP, 'yantrik'],
  'nirmaan.png': [GROUP, 'nirmaan'],
  'stac.png': [GROUP, 'stac'],
  'KBG.png': [GROUP, 'kbg'],
  'Sae.png': [GROUP, 'sae'],
  'GDSC.png': [GROUP, 'gdsc'],
  'Heuristics.png': [GROUP, 'heuristics'],
  'Saic.jpg': [GROUP, 'saic'],
  // NOTE: CG2D has no logo asset anywhere in the old site. `logo` is optional
  // in the schema and the card falls back to a typographic mark.

  // --- event posters (originals; webp twins were renamed and are skipped) --
  'Chassis Crafting Poster.png': [POSTER, 'chassis-crafting'],
  'Scratch Poster.jpg': [POSTER, 'scratch-ya-heads'],
  '3D Thon Poster.png': [POSTER, '3d-thon'],
  'End Of World Poster.png': [POSTER, 'end-of-world'],
  'Takeshi Poster.jpg': [POSTER, 'takeshis-castle'],
  'TIP Poster.jpg': [POSTER, 'tip-hackathon'],
  'Pain Pulse Poster.jpeg': [POSTER, 'pain-pulse'],
  'Disrupt Poster.png': [POSTER, 'disrupt'],
  'Water Rocket Poster.png': [POSTER, 'water-rocket'],
  'Viaduct Poster.png': [POSTER, 'viaduct'],
  'Cell Saga Poster.jpg': [POSTER, 'cell-saga'],
  'utkarsh.png': [POSTER, 'utkarsh'],
  'Xpecto.png': [POSTER, 'xpecto'],
  'Bootcamp.jpg': [POSTER, 'inter-iit-bootcamp'],

  // --- projects ------------------------------------------------------------
  'Mars_rover.png': [PROJECT, 'mars-rover-deimos'],
  'Sae-efficycle.jpeg': [PROJECT, 'sae-efficycle'],
  'Wall_climber.jpg': [PROJECT, 'wall-climber-robot'],
  'SAE_bharat.jpg': [PROJECT, 'formula-bharat'],
  'Cansat.jpeg': [PROJECT, 'inspace-cansat'],

  // --- inter-iit -----------------------------------------------------------
  'inter_iit.jpg': [INTERIIT, 'inter-iit'],
  'GameDev.jpg': [INTERIIT, 'gamedev-challenge'],

  // --- brand ---------------------------------------------------------------
  'logo_nobg.png': [BRAND, 'logo'],
  'logo.png': [BRAND, 'logo-solid'],
  'SnTC.png': [BRAND, 'wordmark'],
};

/**
 * Deliberately dropped. Listed so the decision is reviewable rather than
 * silent — see docs/images.md.
 *   logo-mid.jpg, sntc1.png, sntc3.png  — unreferenced by any HTML/CSS
 *   tenor.gif                            — stray reaction gif
 *   Utkarsh-new.webp                     — its source png was already deleted
 *   Gold/Silver/Bronze.png               — medals are typographic in the redesign
 *   Achievements.png                     — decorative section background
 *   favicon.jpg                          — replaced by a real favicon.svg
 *   Dheeraj.jpg                          — not on the team page
 */

const fmt = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(2)} MB`);

const run = async () => {
  if (!existsSync(SRC)) {
    console.error(`No ${SRC}/ directory — already migrated?`);
    process.exit(1);
  }

  const present = new Set(await readdir(SRC));
  let inBytes = 0;
  let outBytes = 0;
  const rows = [];
  const missing = [];

  for (const [srcName, [group, stem]] of Object.entries(MAP)) {
    if (!present.has(srcName)) {
      missing.push(srcName);
      continue;
    }
    const from = path.join(SRC, srcName);
    const outDir = path.join(OUT, group.dir);
    await mkdir(outDir, { recursive: true });

    const img = sharp(from, { animated: false });
    const meta = await img.metadata();
    /**
     * Decide on real transparency, not on the presence of an alpha channel.
     * Several posters and Mars_rover.png carry a fully-opaque alpha channel,
     * so `hasAlpha` keeps them as PNG and costs ~500 KB each for nothing.
     */
    const { isOpaque } = await img.stats();
    const ext = isOpaque ? 'jpg' : 'png';
    const to = path.join(outDir, `${stem}.${ext}`);

    const pipeline = img.rotate().resize({
      width: group.max,
      height: group.max,
      fit: 'inside',
      withoutEnlargement: true,
    });

    await (ext === 'png'
      ? pipeline.png({ compressionLevel: 9, palette: true }).toFile(to)
      : pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(to));

    const before = (await stat(from)).size;
    const after = (await stat(to)).size;
    inBytes += before;
    outBytes += after;
    rows.push({
      file: `${group.dir}/${stem}.${ext}`,
      from: `${meta.width}x${meta.height}`,
      before,
      after,
    });
  }

  rows.sort((a, b) => b.before - a.before);
  console.log('\nLargest sources:');
  for (const r of rows.slice(0, 10)) {
    const pct = (100 - (r.after / r.before) * 100).toFixed(0);
    console.log(`  ${r.file.padEnd(34)} ${fmt(r.before).padStart(9)} -> ${fmt(r.after).padStart(9)}  (-${pct}%)`);
  }

  if (missing.length) {
    console.log(`\nMapped but not found in ${SRC}/ (${missing.length}):`);
    for (const m of missing) console.log(`  ${m}`);
  }

  const unmapped = [...present].filter(
    (f) => f !== 'webp' && f !== 'inter-iit' && !MAP[f],
  );
  if (unmapped.length) {
    console.log(`\nPresent but intentionally dropped (${unmapped.length}):`);
    for (const u of unmapped) console.log(`  ${u}`);
  }

  console.log(
    `\n${rows.length} images: ${fmt(inBytes)} -> ${fmt(outBytes)} (-${(100 - (outBytes / inBytes) * 100).toFixed(1)}%)`,
  );

  await writeFile(
    'scripts/.image-migration-report.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), rows, missing, unmapped }, null, 2),
  );
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
