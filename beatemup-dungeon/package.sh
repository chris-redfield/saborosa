#!/usr/bin/env bash
#
# package.sh — assemble a self-contained itch.io build of the beat 'em up.
#
# Dev runs against the repo's shared assets (../assets and ../assets-v2) so this
# folder stays lean and the main game's character packs stay a single source.
# This copies exactly what the game asks for, rewrites the two base paths, and
# zips the result — so dist/ (and the zip) run standalone with no repo around.
#
# THE COPY LIST IS DERIVED, NOT WRITTEN HERE. It comes from
# tools/build-manifest.js, which evaluates src/config.js and src/manifest.js —
# the same two files the game runs. That is deliberate and it is the whole point
# of this script's design: the flying dungeon's package.sh carries a hand-written
# `cp` line per asset folder, and its STATE.md records what that cost — a folder
# was added, the copy line was not, dev kept working because it read the repo,
# and every packaged build shipped WITHOUT FLY SPRITES. Nothing catches that by
# eye, because a working dev run and a broken zip differ only in a path.
#
# Add assets in src/manifest.js. This script needs no edit, ever.
#
# Usage:  ./package.sh          (from anywhere)
# Output: dist/  and  beatemup-dungeon-itch.zip
#
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
dist="$here/dist"
zipname="beatemup-dungeon-itch.zip"

command -v node >/dev/null 2>&1 || { echo "ERROR: node is required (it runs the manifest)"; exit 1; }

echo "==> cleaning"
rm -rf "$dist" "$here/$zipname"
mkdir -p "$dist/src"

# ---------------------------------------------------------------- code -----
echo "==> code"
cp "$here/index.html" "$dist/"
cp "$here/src/"*.js "$dist/src/"

# index.html writes its own <script> tags from a hard-coded list, so a NEW
# src/*.js that nobody added to that list is copied into the build and never
# loaded — which shows up as "X is not defined" at boot and looks nothing like a
# packaging problem. Checked here because this is the last moment it is cheap.
echo "==> checking every src/*.js is in index.html's loader"
missing_scripts=0
listed="$(grep -oE "'[a-z-]+'" "$here/index.html" | tr -d "'" | tr '\n' ' ')"
for f in "$here/src/"*.js; do
  b="$(basename "$f" .js)"
  case " $listed " in
    *" $b "*) ;;
    *) echo "   NOT LOADED: src/$b.js is missing from index.html's script list"; missing_scripts=1 ;;
  esac
done
[ "$missing_scripts" -eq 0 ] || { echo "ERROR: fix index.html's script list first"; exit 1; }

# -------------------------------------------------------------- assets -----
# Every file the game will actually request, as "<source>TAB<destination>".
# Sub-paths are preserved, so the two asset roots are MIRRORED into the build
# rather than flattened — which is what lets the rewrite below be two lines.
echo "==> assets (from src/manifest.js)"
node "$here/tools/build-manifest.js" --check >/dev/null || {
  echo "ERROR: a required asset is missing from the repo:"
  node "$here/tools/build-manifest.js" --list
  exit 1
}

count=0
while IFS=$'\t' read -r src dest; do
  [ -n "$src" ] || continue
  mkdir -p "$dist/$(dirname "$dest")"
  cp "$root/$src" "$dist/$dest"
  count=$((count + 1))
done < <(node "$here/tools/build-manifest.js")
echo "    $count files copied"

# ------------------------------------------------------------- rewrite -----
# Point the build at its own local copies. TWO lines, because every path in
# config.js is relative to one of these two bases (including the gamepad
# mapping, unlike the flying dungeon's, which needs a third rewrite).
echo "==> rewriting asset bases"
sed -i "s#ASSET_BASE: '../assets/'#ASSET_BASE: './assets/'#" "$dist/src/config.js"
sed -i "s#ASSET_V2_BASE: '../assets-v2/'#ASSET_V2_BASE: './assets-v2/'#" "$dist/src/config.js"

# VERIFY THE REWRITE LANDED. A sed whose pattern no longer matches does
# nothing and says nothing — the build then silently keeps '../assets/', works
# perfectly when opened from the repo, and 404s everything on itch. This is the
# single most likely way for this script to break, because it breaks by someone
# reformatting a line in config.js.
for k in "ASSET_BASE: './assets/'" "ASSET_V2_BASE: './assets-v2/'"; do
  grep -qF "$k" "$dist/src/config.js" || {
    echo "ERROR: rewrite failed — '$k' not found in dist/src/config.js."
    echo "       The pattern in this script no longer matches src/config.js."
    exit 1
  }
done
# Matches an ASSIGNMENT only — `KEY: '../assets…'` — not any mention of the
# path. A plain substring search flags the comments in config.js that discuss
# these very paths, which is a false alarm that would block every build.
! grep -qE "^[[:space:]]*[A-Za-z_]+:[[:space:]]*'\.\./assets" "$dist/src/config.js" || {
  echo "ERROR: dist/src/config.js still points outside the build:"
  grep -nE "^[[:space:]]*[A-Za-z_]+:[[:space:]]*'\.\./assets" "$dist/src/config.js"
  exit 1
}

# -------------------------------------------------------------- verify -----
# Every destination the manifest named must now exist inside dist/. This is the
# check that would have caught the flying dungeon's missing fly sprites.
echo "==> verifying the build is self-contained"
bad=0
while IFS=$'\t' read -r src dest; do
  [ -n "$dest" ] || continue
  [ -f "$dist/$dest" ] || { echo "   MISSING IN BUILD: $dest"; bad=1; }
done < <(node "$here/tools/build-manifest.js")
[ "$bad" -eq 0 ] || { echo "ERROR: build is incomplete"; exit 1; }

# itch's one hard requirement: index.html at the TOP LEVEL of the zip.
[ -f "$dist/index.html" ] || { echo "ERROR: no index.html at the top of dist/"; exit 1; }

# ----------------------------------------------------------------- zip -----
if command -v zip >/dev/null 2>&1; then
  ( cd "$dist" && zip -qr "../$zipname" . )
  size="$(du -h "$here/$zipname" | cut -f1)"
  files="$(find "$dist" -type f | wc -l | tr -d ' ')"
  echo
  echo "Built: $dist"
  echo "Zip:   $here/$zipname   ($size, $files files)"
  echo
  echo "Upload the ZIP to itch.io and set the project kind to HTML."
  echo "Embed: 1280x720, fullscreen ON, mobile OFF, autostart OFF."
else
  echo "Built: $dist  (zip not installed — zip the CONTENTS of dist/ yourself)"
fi
