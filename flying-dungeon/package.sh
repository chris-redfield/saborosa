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
mkdir -p "$dist/src" "$dist/assets/flying-dungeon/character-sheets"

# --- code ---
cp "$here/index.html" "$dist/"
cp "$here/src/"*.js "$dist/src/"

# --- assets (compressed webp frames + character/fire sheets; NOT originals/) ---
cp "$src_assets/"*.webp "$dist/assets/flying-dungeon/"
cp "$src_assets/character-sheets/"*.png "$dist/assets/flying-dungeon/character-sheets/"

# --- point the build at its local assets (single-line rewrite) ---
sed -i "s#ASSET_BASE: '../assets-v2/flying-dungeon/'#ASSET_BASE: './assets/flying-dungeon/'#" "$dist/src/config.js"

# --- zip for upload ---
if command -v zip >/dev/null 2>&1; then
  ( cd "$dist" && zip -qr "../flying-dungeon-itch.zip" . )
  echo "Built: $dist"
  echo "Zip:   $here/flying-dungeon-itch.zip  (upload this to itch.io)"
else
  echo "Built: $dist  (zip not installed — zip the dist/ folder's CONTENTS yourself)"
fi
