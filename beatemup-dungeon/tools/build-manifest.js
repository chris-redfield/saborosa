#!/usr/bin/env node
/**
 * build-manifest.js — print every asset the game will request, as
 * `<repo-relative source>\t<dist-relative destination>` pairs.
 *
 * It evaluates `src/config.js` and `src/manifest.js` — THE SAME TWO FILES THE
 * GAME RUNS — so the copy list cannot drift from what the browser asks for.
 * That is the entire reason this exists rather than a list of `cp` lines in
 * package.sh: the flying dungeon has those, and its own STATE.md records the
 * consequence of forgetting one (every packaged build went out without fly
 * sprites, because dev read the repo and only the zip 404'd).
 *
 * Usage:
 *   node tools/build-manifest.js            pairs, tab-separated (for package.sh)
 *   node tools/build-manifest.js --list     human-readable, with sizes
 *   node tools/build-manifest.js --check    verify every source exists; exit 1 if not
 *
 * Run from anywhere; paths are resolved against the repo root.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const GAME = path.dirname(HERE);              // beatemup-dungeon/
const ROOT = path.dirname(GAME);              // repo root

// Evaluate config + manifest in one sandbox. No DOM, no fetch — which is why
// src/manifest.js must stay free of browser globals.
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
for (const f of ['config.js', 'manifest.js']) {
  const src = fs.readFileSync(path.join(GAME, 'src', f), 'utf8');
  vm.runInContext(src, sandbox, { filename: f });
}
const CONFIG = sandbox.CONFIG;
const entries = sandbox.assetManifest();

/**
 * A config-style path → { src, dest }, both relative.
 *
 * THE TWO ASSET ROOTS ARE MIRRORED RATHER THAN FLATTENED. Sub-paths are kept
 * exactly ('flying-dungeon/enemy-sheets/...', 'beatemup-dungeon/...'), so the
 * build needs no path rewriting beyond the two base constants and nothing in
 * the game has to know it is running from a zip.
 */
function resolve(p) {
  if (p.slice(0, 3) === 'v2:') {
    const rest = p.slice(3);
    return { src: path.join('assets-v2', rest), dest: path.join('assets-v2', rest) };
  }
  return { src: path.join('assets', p), dest: path.join('assets', p) };
}

const mode = process.argv[2] || '--pairs';
const seen = new Set();
const rows = [];
for (const e of entries) {
  const r = resolve(e.src);
  if (seen.has(r.src)) continue;              // one file, one copy
  seen.add(r.src);
  rows.push({ ...r, key: e.key, how: e.how, optional: !!e.optional });
}

let missing = 0, bytes = 0;
for (const r of rows) {
  const abs = path.join(ROOT, r.src);
  const ok = fs.existsSync(abs);
  if (ok) bytes += fs.statSync(abs).size;
  else if (!r.optional) missing++;

  if (mode === '--pairs') {
    if (ok) process.stdout.write(`${r.src}\t${r.dest}\n`);
  } else {
    const size = ok ? (fs.statSync(abs).size / 1024).toFixed(0) + ' KB' : '—';
    const flag = ok ? '  ' : (r.optional ? ' ?' : ' X');
    process.stdout.write(
      `${flag} ${r.key.padEnd(12)} ${r.how.padEnd(5)} ${size.padStart(9)}  ${r.src}\n`);
  }
}

if (mode !== '--pairs') {
  process.stdout.write(`\n   ${rows.length} files, ${(bytes / 1048576).toFixed(1)} MB\n`);
  if (missing) process.stdout.write(`   ${missing} REQUIRED FILE(S) MISSING (X above)\n`);
}
if (mode === '--check' && missing) process.exit(1);
