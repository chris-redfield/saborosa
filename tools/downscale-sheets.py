#!/usr/bin/env python3
"""Emit downscaled GAME copies of the big sprite sheets — OFFLINE, resolution
only, plain Lanczos, NO post-processing (user rule: the art stays as drawn).

Why: the game draws these sheets at small scales (blocks at BLOCK_SCALE 0.14,
map objects at 0.3, coconut at ~0.3), but shipped them at author resolution
(4960x7016 ≈ 132MB decoded each). On weak/no-GPU machines every sprite draw
then READS 10–50x more source pixels than it puts on screen (software raster is
source-bound when minifying) — measured ~32ms per sprite (PERFORMANCE.md C8).
Factors keep ≥1.5x headroom over each sheet's max in-game draw scale.

The ORIGINALS are untouched: the map editor and def-building tools keep using
them, and the defs JSONs keep authoring-resolution coordinates. The game maps
def coords onto these smaller sheets via `game.sheetScales` (game.js).

Outputs (assets/): *-small.png versions of the three sheets below.
"""
import sys
import warnings
warnings.filterwarnings('ignore')
from PIL import Image

A = 'assets/'
# (source, output, factor, max in-game draw scale)
JOBS = [
    # NOTE: saborosa-assets-002-game.png is NO LONGER produced here. The objects
    # sheet (saborosa-objetos-novos) is small and ships content-cropped 1:1 by
    # tools/build-block-defs.py — do not re-add it, or you'd clobber that crop
    # with a blurry 0.25 downscale of the old master.
    ('saborosa-assets-001.png',  'saborosa-assets-001-game.png',  0.45, 0.30),
    ('saborosa-chat-002-2.png',  'saborosa-chat-002-2-game.png',  0.45, 0.31),
]


def main():
    for src, out, k, used in JOBS:
        im = Image.open(A + src)
        w, h = im.size
        nw, nh = round(w * k), round(h * k)
        im.resize((nw, nh), Image.LANCZOS).save(A + out, optimize=True)
        print(f'{src}: {w}x{h} -> {nw}x{nh} (factor {k}, max draw {used}, '
              f'~{nw*nh*4//2**20}MB decoded, was ~{w*h*4//2**20}MB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
