#!/usr/bin/env python3
"""
build-orb-frames.py — the boss's projectile sheet.

The Time Boss throws the SAME spiky ink sphere the root game uses as an ambient
FX burst (`assets/saborosa-assets-003-small.png`, row 4 of the assets-003 pack,
listed as the `animation` block in `assets/saborosa-assets-003-fx-small.json`).
Rather than reach across into the root game's sheet at runtime — 1240x1754 of
which we want five small circles — this cuts those five frames out and lays them
onto a uniform grid the flying dungeon can blit without a per-frame table.

    saborosa-orb.webp   5 cells of ORB_CELL px, one row, lossless

The frames GROW (132px to 216px) and are concentric, so every frame is CENTRED
in its cell: the sphere then inflates about its own middle for free, and the
draw code needs one rect formula instead of five offsets. The cell is sized off
the largest frame, exactly like the coin sheet — same reasoning, same payoff
(swapping the art is a filename change and nothing else).

Lossless because it is flat black line art: lossy webp rings the outlines.

    python3 tools/build-orb-frames.py
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MASTER = os.path.join(ROOT, 'assets', 'saborosa-assets-003-small.png')
DEFS = os.path.join(ROOT, 'assets', 'saborosa-assets-003-fx-small.json')
OUT_DIR = os.path.join(ROOT, 'assets-v2', 'flying-dungeon')
OUT = os.path.join(OUT_DIR, 'saborosa-orb.webp')


def main():
    if not os.path.exists(MASTER):
        sys.exit('missing master: %s' % MASTER)
    frames = json.load(open(DEFS))['animation']['frames']
    im = Image.open(MASTER).convert('RGBA')

    cell = max(max(f['w'], f['h']) for f in frames)
    sheet = Image.new('RGBA', (cell * len(frames), cell), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        crop = im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        # Centred, so the growth is symmetric about the cell's middle.
        sheet.alpha_composite(crop, (i * cell + (cell - f['w']) // 2,
                                     (cell - f['h']) // 2))

    os.makedirs(OUT_DIR, exist_ok=True)
    sheet.save(OUT, lossless=True, quality=100, method=6)
    print('%d frames, cell %d -> %s (%.0fKB)'
          % (len(frames), cell, OUT, os.path.getsize(OUT) / 1024))
    print('set ORB_CELL: %d in config.js' % cell)


if __name__ == '__main__':
    main()
