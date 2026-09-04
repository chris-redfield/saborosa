#!/usr/bin/env python3
"""Cut the WORM PATCHES out of their four sheets, for the bookcase's wall.

WHAT THEY ARE. Two patches of maggots, `A` dense and `B` sparse, each drawn
TWICE so the patch can boil in place. They go on the back wall of level 3 -- the
bookcase -- and they are SCENERY in the strict sense this game uses (see
beatemup-dungeon/STATE.md, *The flies*): no hitbox, no z-sort, no collision,
nothing asks them a question. Same bargain as the desert's cigarette mounds, and
the same reason a room can afford a lot of them.

    batidao-vermes-A-01 / A-02   the dense field
    batidao-vermes-B-01 / B-02   the sparse one

⚠️ 01 AND 02 ARE BOIL FRAMES, AND THAT WAS CHECKED BEFORE ANYTHING WAS WIRED --
composited on one shared rect, the difference is individual worms wriggling
inside an arrangement that does not move. That check is this project's standing
rule for a new sheet (it caught HORACIO's F1..F4, which look like a boil and are
four different bodies), and here it PASSED: these really are two frames of one
drawing.

⚠️ SO THE TWO FRAMES OF A VARIATION SHARE ONE CROP RECT, and that is the whole
reason this tool is not four independent crops. Cropping each frame to its own
ink moves the anchor between them, and the patch would JUMP a few pixels every
time it boiled -- which does not read as worms wriggling, it reads as the wall
twitching. The rect is the union over the pair.

⚠️ CUT ON COLUMN GAPS -- AND THE CIGARETTE CUTTER CUTS ON ROW BANDS. Same idea,
different axis, and the axis is a property of the SHEET rather than a choice:
the cigarette sheets stack two mounds vertically with clear space between them,
so a row band is one mound. These sheets do not band by row AT ALL -- measured,
`A` is a single unbroken band at every gap from 20 to 140 -- because the worms
run right across the width. They separate by COLUMN instead: at a 10px gap `A`
falls into 4 knots and `B` into 5, which is the same "chop it up and compose
from the pieces" the mounds get, read off this art instead of that one.

⚠️ AND ONE PIECE IS NOT ALWAYS A KNOT. `B` also yields a 91x109 speck, which
columns exactly like a real one -- the cigarette sheet has the identical problem
(a stray 143x906 mark) and the identical answer. Pieces under MIN_W are dropped
and the tool ASSERTS the final count, so a sheet that gains or loses a knot
fails here rather than shipping a smudge as level art.

⚠️ THE COLUMN RUNS ARE FOUND ON THE **UNION** OF THE TWO BOIL FRAMES, and that
is what makes chopping safe at all. Worms at a knot's edge wander between frames,
so runs found on frame 01 alone would put a slightly different cut on frame 02 --
and the two halves of one piece would no longer be the same object. One run list,
both frames, one rect each.

THE ANCHOR IS THE CENTRE, not bottom-centre like a mound. A mound is placed by
the ground it sits on; a patch of worms is stuck to a WALL and has no base, so
it is placed by its middle.

ONE SCALE FOR BOTH, which is the standing rule for a pack in this project.

Output (assets-v2/beatemup-dungeon/):
  vermes-fundo-game.png      packed atlas
  vermes-fundo-sprites.json  { scale, frames: [{x,y,w,h,ax,ay}], variants }
                             `variants[v]` is ONE KNOT's boil frames, in order.
"""
import json
import os

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

SRC = 'assets-v2/beatemup-dungeon/batidao-vermes-%s-%02d.png'
OUT = 'assets-v2/beatemup-dungeon/vermes-fundo'
VARIANTS = ['A', 'B']
FRAMES = 2
WANT = 9           # the tool refuses to write anything else -- see the header
ALPHA = 8
COL_GAP = 10       # empty columns tolerated inside one knot of worms
MIN_W = 200        # narrower than this is a speck, not a knot
# ⚠️ MEASURED AGAINST THE WALL, NOT CHOSEN FOR THE FILE. Level 3's belt sits at
# topY 470, so the wall is the ~470px above it. `A` is 2971 source px wide and
# 1750 tall, so 0.115 puts one patch at 342 x 201 drawn -- about a quarter of the
# screen wide and 43% of the wall's height. Several fit across without any one of
# them being the wall.
#
# QUALITY IS FREE HERE: an 8.7x downscale, so nothing is ever stretched. The
# note on the cigarettes' SCALE applies -- the atlas grows by the SQUARE of this.
SCALE = 0.115
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
    sheets = {}
    for v in VARIANTS:
        for i in range(1, FRAMES + 1):
            path = SRC % (v, i)
            if not os.path.exists(path):
                raise SystemExit(f'missing {path}')
            im = Image.open(path).convert('RGBA')
            sheets[(v, i)] = (im, np.array(im)[:, :, 3] > ALPHA)

    frames, variants, tiles, sheet_of = [], [], [], []
    for vi, v in enumerate(VARIANTS):
        # THE UNION OF THE BOIL FRAMES decides where the cuts fall -- see header.
        union = sheets[(v, 1)][1] | sheets[(v, 2)][1]
        for (cx0, cx1) in runs(union.any(axis=0), COL_GAP):
            band = union[:, cx0:cx1 + 1]
            rows = np.nonzero(band.any(axis=1))[0]
            cols = np.nonzero(band.any(axis=0))[0]
            x0, x1 = cx0 + int(cols.min()), cx0 + int(cols.max())
            y0, y1 = int(rows.min()), int(rows.max())
            w, h = x1 - x0 + 1, y1 - y0 + 1
            if w < MIN_W:
                print(f'  skipped {w}x{h} at x{x0} ({v}) -- under MIN_W')
                continue
            sw = max(1, int(round(w * SCALE)))
            sh = max(1, int(round(h * SCALE)))
            ids = []
            for i in range(1, FRAMES + 1):
                t = sheets[(v, i)][0].crop((x0, y0, x1 + 1, y1 + 1))
                ids.append(len(tiles))
                tiles.append(t.resize((sw, sh), Image.LANCZOS))
            variants.append(ids)
            sheet_of.append(vi)
            print(f'  {v}{len(variants):2d}  source {w}x{h} at ({x0},{y0})'
                  f'  ->  {sw}x{sh} drawn')

    if len(variants) != WANT:
        raise SystemExit(f'expected {WANT} knots, found {len(variants)}')

    # ONE COLUMN, like the mounds. ⚠️ THAT MAKES THE ATLAS TALL AND THIN --
    # 119x2474 at SCALE 0.115 -- and the HEIGHT is what would hit a texture
    # limit, not the width. It is well inside this project's `bigTextureCap`
    # (3200) today, but raising SCALE much past 0.148 would not be: check the
    # printed size if it moves, and go to a grid rather than shrinking the art.
    W = max(t.width for t in tiles) + PAD
    H = sum(t.height + PAD for t in tiles)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = 0
    for t in tiles:
        atlas.paste(t, (0, y))
        frames.append({'x': 0, 'y': y, 'w': t.width, 'h': t.height,
                       # CENTRE, not bottom-centre -- it is stuck to a wall and
                       # has no base to stand on. See the header.
                       'ax': round(t.width / 2, 1),
                       'ay': round(t.height / 2, 1)})
        y += t.height + PAD

    atlas.save(OUT + '-game.png')
    with open(OUT + '-sprites.json', 'w') as fh:
        json.dump({'scale': SCALE, 'frames': frames, 'variants': variants,
                   # WHICH SHEET EACH KNOT CAME OFF: 0 = A (dense), 1 = B
                   # (sparse). Kept so the scatter can be biased toward one look
                   # without the game having to know pixel counts.
                   'sheets': VARIANTS, 'sheetOf': sheet_of}, fh, indent=1)
    print(f'{OUT}-game.png  {atlas.size[0]}x{atlas.size[1]}  '
          f'{len(frames)} frames in {len(variants)} knots, '
          f'{os.path.getsize(OUT + "-game.png") / 1024:.0f} KB')


if __name__ == '__main__':
    main()
