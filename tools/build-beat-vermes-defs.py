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
MAX_DIM = 3200     # this project's own bigTextureCap; the tool asserts on it
# ⚠️ TRIPLED ON REQUEST 2026-09-04: *"make them all have the same size... and
# make them be 3x bigger than what they are now."* It was 0.115 with the drawn
# size varying per band (0.90 / 1.15 / 1.45), whose MEAN effective scale was
# 0.115 x 1.1667 = 0.1342; three times that is 0.4025, rounded here to 0.40.
#
# ⚠️ THE SIZE MOVED HERE RATHER THAN INTO `bandScale`, AND THAT IS THE POINT.
# The cigarettes multiply their scale at DRAW time because their bands are
# deliberately different sizes -- a depth cue that has to stay live. These are
# all one size now, so drawing a 0.115 tile at 3.5x would just magnify art that
# had already been thrown away: 105x199 stretched to 367x696, soft. Cut once, at
# the size it is drawn. **THIS IS THE SIZE KNOB NOW** -- re-run the tool.
#
# QUALITY IS STILL FREE: a 2.5x downscale from source, so nothing is stretched.
# ⚠️ AND THE ATLAS GREW BY THE SQUARE OF IT -- which is exactly what the old note
# here predicted would break the single-column layout, and it did. See the packer.
SCALE = 0.40
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

    # ⚠️ A GRID, NOT ONE COLUMN, AND THE OLD NOTE HERE CALLED THIS EXACTLY. One
    # column was right at SCALE 0.115 (119x2474) and it said "raising SCALE much
    # past 0.148 would not be [inside the cap]; go to a grid rather than
    # shrinking the art". At 0.40 a single column is 417x8659 -- nearly three
    # times MAX_DIM -- so this is that grid, and the art was not shrunk.
    #
    # The column count is SEARCHED rather than sqrt(n): these tiles range from
    # 93x140 to 411x698, and sqrt is only square when the tiles are. Trying every
    # count and keeping the smallest longest side costs nothing at build time.
    # Same packer as tools/build-beat-horacio-defs.py, for the same reason.
    def shelf(cols_n):
        x = y = rowh = W = 0
        place = []
        for i, t in enumerate(tiles):
            if i % cols_n == 0 and i:
                y += rowh + PAD
                x, rowh = 0, 0
            place.append((x, y))
            rowh = max(rowh, t.height)
            x += t.width + PAD
            W = max(W, x)
        return W, y + rowh + PAD, place

    W, H, place = min((shelf(c) for c in range(1, len(tiles) + 1)),
                      key=lambda r: (max(r[0], r[1]), r[0] * r[1]))
    if W > MAX_DIM or H > MAX_DIM:
        raise SystemExit(f'atlas is {W}x{H}, over MAX_DIM {MAX_DIM}. '
                         f'Lower SCALE (now {SCALE}).')
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for t, (x, y) in zip(tiles, place):
        atlas.paste(t, (x, y))
        frames.append({'x': x, 'y': y, 'w': t.width, 'h': t.height,
                       # CENTRE, not bottom-centre -- it is stuck to a wall and
                       # has no base to stand on. See the header.
                       'ax': round(t.width / 2, 1),
                       'ay': round(t.height / 2, 1)})

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
