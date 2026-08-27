#!/usr/bin/env python3
"""Cut the cigarette MOUNDS out of the three background sheets.

WHAT THEY ARE. Six low drifts of cigarette butts, two to a file, drawn to lie ON
the ground rather than behind it -- the desert's floor is covered in them and the
player walks over the top. They are SCENERY in the strict sense this game uses
(see beatemup-dungeon/STATE.md, *The flies*): no hitbox, no z-sort, no collision,
nothing asks them a question. That is the whole reason they are cheap enough to
cover a room with.

⚠️ CUT ON ROW BANDS, NOT ON BODIES. The enemy cutter finds frames as connected
components over a size threshold, because a fighter is one body. A mound is NOT:
it is fifty loose butts, most of them touching, several of them not. Its
components are the individual cigarettes. So the unit here is the BAND -- a
horizontal stripe of the sheet with ink in it -- and everything inside one band
is one mound.

⚠️ AND ONE BAND IS NOT A MOUND. `coconut-cigarros-fundo.png` carries a stray
143x906 mark in its top-left corner, which bands exactly like a drift does. Bands
narrower than MIN_W are dropped, and the tool asserts the final count -- so a
sheet that gains or loses a mound fails here rather than shipping a scrap of
paper as level art.

ONE SCALE FOR ALL SIX, which is the standing rule for a pack in this project:
never rescale sprites against each other to even them out. The illustrator drew
one 3270px wide and another 6339px, and that difference is the point -- the small
ones fill gaps the big ones leave.

THE ANCHOR IS BOTTOM-CENTRE. A mound has no feet and no base to find; it is a
patch of ground, so it is placed by the point it sits on and centred on it.

Output (assets-v2/beatemup-dungeon/):
  cigarros-fundo-game.png      packed atlas
  cigarros-fundo-sprites.json  { scale, frames: [{x,y,w,h,ax,ay}] }
"""
import json
import os

import numpy as np
from PIL import Image

SRC = [
    'assets-v2/beatemup-dungeon/coconut-cigarros-fundo.png',
    'assets-v2/beatemup-dungeon/coconut-cigarros2-fundo.png',
    'assets-v2/beatemup-dungeon/coconut-cigarros3-fundo.png',
]
OUT = 'assets-v2/beatemup-dungeon/cigarros-fundo'
WANT = 6           # the tool refuses to write anything else
ALPHA = 8
BAND_GAP = 60      # empty rows tolerated inside one mound
MIN_W = 1000       # narrower than this is not a mound -- see the header
# ⚠️ MEASURED AGAINST THE BELT, NOT CHOSEN FOR THE FILE. The desert's belt is
# 380px deep and the widest mound is 6339px of source, so 0.157 puts it at 995
# drawn px across and 201 tall -- a drift nearly a screen wide occupying over
# half the walkable depth.
#
# ⚠️ IT HAS GONE UP TWICE ON REQUEST: 0.11 -> 0.143 (+30%) -> 0.157 (+10%).
# Two things follow each time and neither is automatic:
#
#   * THE COVERAGE GOES UP UNLESS `rows` COMES DOWN. The scatter spaces mounds by
#     their own WIDTH, so x spacing scales itself -- but each mound now covers
#     more DEPTH, and depth is what `rows` is for. CONFIG.SCENERY's `spacing` and
#     `zTo` were re-tuned both times to hold the coverage where it was settled.
#   * THE ATLAS GROWS BY THE SQUARE OF IT: 587KB -> 851KB -> ~1MB. Still a single
#     texture and still small; worth knowing before it goes up again.
#
# QUALITY IS FREE HERE and will be for a while: the widest source mound is
# 6339px, so even at 0.157 this is a 6.4x downscale. Nothing is ever stretched.
SCALE = 0.157
PAD = 2


def runs(flags, gap):
    out, start, hole = [], None, 0
    for i, on in enumerate(flags):
        if on:
            if start is None:
                start = i
            hole = 0
        elif start is not None:
            hole += 1
            if hole > gap:
                out.append((start, i - hole))
                start = None
    if start is not None:
        out.append((start, len(flags) - 1))
    return out


def main():
    tiles = []
    for path in SRC:
        if not os.path.exists(path):
            raise SystemExit(f'missing {path}')
        im = Image.open(path).convert('RGBA')
        a = np.array(im)[:, :, 3] > ALPHA
        for (y0, y1) in runs(a.any(axis=1), BAND_GAP):
            cols = np.nonzero(a[y0:y1 + 1].any(axis=0))[0]
            x0, x1 = int(cols.min()), int(cols.max())
            if x1 - x0 + 1 < MIN_W:
                print(f'  skipped {x1 - x0 + 1}x{y1 - y0 + 1} at y{y0} '
                      f'({os.path.basename(path)}) -- under MIN_W')
                continue
            tiles.append(im.crop((x0, y0, x1 + 1, y1 + 1)))

    if len(tiles) != WANT:
        raise SystemExit(f'expected {WANT} mounds, found {len(tiles)}')

    tiles = [t.resize((max(1, int(round(t.width * SCALE))),
                       max(1, int(round(t.height * SCALE)))), Image.LANCZOS)
             for t in tiles]

    # One column, tallest first -- six wide flat tiles shelf-pack into a tall
    # thin atlas whatever is done, so the simple layout is also the small one.
    W = max(t.width for t in tiles) + PAD
    H = sum(t.height + PAD for t in tiles)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    frames, y = [], 0
    for t in tiles:
        atlas.paste(t, (0, y))
        frames.append({'x': 0, 'y': y, 'w': t.width, 'h': t.height,
                       # Bottom-centre: a mound is placed by the ground it sits
                       # on and has no base to find. See the header.
                       'ax': round(t.width / 2, 1), 'ay': float(t.height)})
        y += t.height + PAD

    atlas.save(OUT + '-game.png')
    with open(OUT + '-sprites.json', 'w') as fh:
        json.dump({'scale': SCALE, 'frames': frames}, fh, indent=1)
    print(f'{OUT}-game.png  {atlas.size[0]}x{atlas.size[1]}  {len(frames)} mounds, '
          f'{os.path.getsize(OUT + "-game.png") / 1024:.0f} KB')
    for i, f in enumerate(frames):
        print(f'  {i}  {f["w"]:4d}x{f["h"]:4d}')


if __name__ == '__main__':
    main()
