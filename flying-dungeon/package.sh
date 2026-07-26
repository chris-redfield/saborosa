#!/usr/bin/env bash
#
# package.sh — assemble a self-contained itch.io build of the Flying Dungeon.
#
# Dev runs against the shared repo assets (../assets-v2/flying-dungeon) so the
# repo stays lean. This copies those assets in, rewrites the single ASSET_BASE
# line in config.js to a local path, and zips the result — so dist/ (and the
# zip) run standalone with no repo around them.
#
# Usage:  ./package.sh        (from the flying-dungeon/ folder)
# Output: flying-dungeon/dist/  and  flying-dungeon/flying-dungeon-itch.zip
#
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
dist="$here/dist"
src_assets="$root/assets-v2/flying-dungeon"

if [ ! -d "$src_assets" ]; then
  echo "ERROR: shared assets not found at $src_assets" >&2
  exit 1
fi

rm -rf "$dist"
mkdir -p "$dist/src" "$dist/assets/flying-dungeon/character-sheets" \
         "$dist/assets/flying-dungeon/enemy-sheets" \
         "$dist/assets/flying-dungeon/select" \
         "$dist/assets/flying-dungeon/coin" \
         "$dist/assets/flying-dungeon/game-over" \
         "$dist/assets/flying-dungeon/audio"

# --- code ---
cp "$here/index.html" "$dist/"
cp "$here/src/"*.js "$dist/src/"

# --- assets (compressed webp frames + character/fire sheets; NOT originals/) ---
cp "$src_assets/"*.webp "$dist/assets/flying-dungeon/"
cp "$src_assets/character-sheets/"*.png "$dist/assets/flying-dungeon/character-sheets/"
cp "$src_assets/enemy-sheets/"*.png "$dist/assets/flying-dungeon/enemy-sheets/"
cp "$src_assets/select/"*.webp "$dist/assets/flying-dungeon/select/"
cp "$src_assets/coin/"*.webp "$dist/assets/flying-dungeon/coin/"
cp "$src_assets/game-over/"*.webp "$dist/assets/flying-dungeon/game-over/"
# Audio: the ROOT of audio/ only, never audio/music/. The stems in there are
# ingredients — three separate takes that tools/bake-trilha.py has already
# resolved into trilha-mix.ogg — and shipping them would be a megabyte of files
# the game has no code to play.
cp "$src_assets/audio/"*.ogg "$dist/assets/flying-dungeon/audio/"

# --- the controller mapping (the MAIN GAME's file, shared not copied) ---
# Optional: a build without it still plays, on standard-layout pad defaults.
cp "$here/../assets/gamepad-mapping.json" "$dist/assets/" 2>/dev/null \
  || echo "note: no gamepad-mapping.json — pads will use standard defaults"

# --- point the build at its local assets (single-line rewrite) ---
sed -i "s#ASSET_BASE: '../assets-v2/flying-dungeon/'#ASSET_BASE: './assets/flying-dungeon/'#" "$dist/src/config.js"
sed -i "s#GAMEPAD_MAPPING: '../assets/gamepad-mapping.json'#GAMEPAD_MAPPING: './assets/gamepad-mapping.json'#" "$dist/src/config.js"

# --- zip for upload ---
if command -v zip >/dev/null 2>&1; then
  ( cd "$dist" && zip -qr "../flying-dungeon-itch.zip" . )
  echo "Built: $dist"
  echo "Zip:   $here/flying-dungeon-itch.zip  (upload this to itch.io)"
else
  echo "Built: $dist  (zip not installed — zip the dist/ folder's CONTENTS yourself)"
fi
