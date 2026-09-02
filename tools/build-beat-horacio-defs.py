#!/usr/bin/env python3
"""Cut HORACIO -- the desert's boss -- out of his thirteen masters.

WHAT ARRIVED. Thirteen masters, each 13443x2371, each holding EIGHT FACINGS of
one body in one row. The FILE NUMBER is his spike level and the F SUFFIX is his
STATE:

    001  the joaninha    smooth spotted dome, no spikes    F1 F2 F3 F4
    002  level 1         small spikes ("espetos pequenos") F1 F2 F3
    003  level 2         medium spikes                     F1 F2 F3
    004  level 3         grandao, full spikes              F1 F2 F3

    F1  armoured   the red body, shell on, standing on its legs
    F2  exposed    the same shell over a BEIGE body and beige legs -- the
                   creature showing through, a hurt/vulnerable read
    F3  ball       tucked in, black underneath, no legs -- the "bolinha" he
                   roams and charges in
    F4  naked      the beige creature with NO shell at all. Level 001 only,
                   because a creature with no shell has no spike level.

⚠️ I READ F1..F4 AS BOIL FRAMES FIRST AND THEY ARE NOT. They are four different
BODIES. The mistake was caught by compositing every frame on one shared ground
line before wiring anything -- the "boil" ghosted a foot low and half a body
wide, which no wobble does. That check is the standing rule for a new sheet in
this project and this is the third time it has paid.

⚠️ SO THERE ARE NO ANIMATION FRAMES IN THIS PACK AT ALL. No idle, no walk cycle,
no boil. Every state is ONE drawing per facing. His motion has to come from
translation, from turning through the eight facings, and from state changes --
not from a cycle. Do not invent one by alternating F1/F2: those are different
bodies and it would read as him flickering between hurt and well.

⚠️ THE EIGHT FACINGS ARE DRAWN, NOT MIRRORED, AND THAT WAS MEASURED. Their
widths are palindromic (1092, 1157, 994, 1101, 1258, 1101, 994, 1157), which
makes "store five and h-flip three" look free -- it is not. Comparing facing 1
against a mirrored facing 7 gives a mean absolute difference of 5.9 per channel,
not 0: the illustrator drew both sides. Flipping would throw half the drawings
away and is the exact thing the pack rule forbids. All eight are cut as drawn.

⚠️ THE MASTERS SHARE A GROUND LINE AND THAT REGISTRATION IS THE WHOLE ANCHOR.
Across all four levels the feet sit at rows 1794..1874 while the tops climb
792 -> 690 -> 551 -> 410 as the spikes grow. So the frames are NOT bottom-
anchored on their own ink: a 3/4-back pose puts its legs lower than a head-on
one, and bottom-anchoring each frame would stamp all of them onto the same line
and destroy the perspective the illustrator drew. Instead ONE master row is the
ground for the whole pack and every `ay` is measured down to it. A pose whose
lowest pixel is 60px above that line is MEANT to be 60px above it.

⚠️ ONE CROP RECT AND ONE ANCHOR PER (LEVEL, FACING), SHARED BY ITS STATES. The
states are the same creature standing in the same place with its body changed,
so cropping each to its own ink would move the anchor between them and he would
JUMP on every tuck and every hurt. The shared rect costs a little empty margin
in each tile and buys a state change that does not move him a pixel.

⚠️ ONE SCALE FOR THE WHOLE PACK, measured off level 1 -- the body he ENTERS in.
Never per level: the levels having different heights IS the feature, and scaling
each to a common height would draw four identical creatures and delete the
growth. `TARGET_H` is the knob and it is the level-1 body height on screen.

Output (assets-v2/beatemup-dungeon/):
  horacio-L<n>-game.png  ONE ATLAS PER LEVEL -- see the note on TARGET_H
  horacio-sprites.json   { scale, ground, levels, states, facings, sheets,
                           frames, index }
                         each frame carries `sheet`, the index into `sheets`
                        index[level][state][facing] -> one frame id.
                        state 0 armoured, 1 exposed, 2 ball, 3 naked.
                        ⚠️ ONLY LEVEL 0 HAS STATE 3; the others hold null there,
                        so a lookup must fall back rather than index blindly.
"""
import json
import os

import numpy as np
from PIL import Image

SRC = 'assets-v2/beatemup-dungeon/boss_horacio/batidao-boss-espeto-%s-F%d.png'
OUT = 'assets-v2/beatemup-dungeon/horacio'
# (sheet number, how many boil frames it has). Order IS the level order.
LEVELS = [('001', 4), ('002', 3), ('003', 3), ('004', 3)]
STATE_NAMES = ['armoured', 'exposed', 'ball', 'naked']
FACINGS = 8
ALPHA = 40
COL_GAP = 80       # empty columns tolerated inside one facing
SPECK = 0.002      # a row holding under this fraction of the fattest row is dirt

# ⚠️ THE LEVEL-1 BODY HEIGHT ON SCREEN, and every other level follows from it.
# A mook is `fighterSizePx` 136.8 tall and HIPOLITO the horse draws at about 319.
# 230 enters him well under the horse and takes him to ~291 as the grandao --
# so the desert's boss stays smaller than the game's FINAL boss at every level,
# which is the right way round for a stage 2 fight.
#
# ⚠️ IT HAS MOVED THREE TIMES IN ONE SESSION, ALL ON REQUEST:
#     230 -> 460  "make the boss double its current size"
#     460 -> 322  "this was too much. make him 30% smaller"   (0.7 x 460)
#     322 -> 354  "make him 10% bigger"                       (1.1 x 322)
# EVERY ONE IS A NEW TARGET RELATIVE TO THE CURRENT VALUE, not a complaint about
# the previous one and not a walk back to an earlier number. Read the next one
# the same way: apply the percentage to what is here now.
#
# THE PER-LEVEL SPLIT STAYS EVEN THOUGH 322 WOULD ALMOST FIT ONE TEXTURE:
# ~12.6M px of tile packs to about 3550x3550, still over MAX_DIM. It also stops
# the next size change from being a structural change. Four times the
# pixels does not fit one texture: at 460 the whole pack packs to roughly
# 5950x6250, past this project's `bigTextureCap` (3200) and far past the 4096
# limit a lot of older hardware still has. TEXTURE DIMENSIONS ARE THE WALL, not
# file size, so no amount of compression answers it and the pack had to split.
#
# Splitting BY LEVEL rather than arbitrarily is the version that costs nothing
# at run time: only one level is ever on screen, so the GPU still touches a
# single texture per frame -- two for the instant the theatre swaps.
#
# ⚠️ RAISE THIS AGAIN AND READ THE PRINTED SIZES. The tool prints every atlas
# every run for exactly that reason, and refuses to write one over MAX_DIM.
TARGET_H = 354
MAX_DIM = 3200     # this project's own bigTextureCap; the tool asserts on it
PAD = 2


def facings_of(mask):
    """The eight column runs. One row of bodies, so runs ARE the facings."""
    cols = mask.any(axis=0)
    runs, st, hole = [], None, 0
    for i, on in enumerate(cols):
        if on:
            if st is None:
                st = i
            hole = 0
        elif st is not None:
            hole += 1
            if hole > COL_GAP:
                runs.append((st, i - hole))
                st = None
    if st is not None:
        runs.append((st, len(cols) - 1))
    return runs


def rows_of(mask):
    """Ink rows, with specks dropped. Returns (top, bottom) or None."""
    counts = mask.sum(axis=1)
    if not counts.any():
        return None
    keep = np.nonzero(counts > SPECK * counts.max())[0]
    return int(keep.min()), int(keep.max())


def main():
    # ---- load every master once, and find each level's eight facings --------
    sheets = {}
    for num, nf in LEVELS:
        for fi in range(1, nf + 1):
            path = SRC % (num, fi)
            if not os.path.exists(path):
                raise SystemExit(f'missing {path}')
            im = Image.open(path).convert('RGBA')
            sheets[(num, fi)] = (im, np.array(im)[:, :, 3] > ALPHA)

    cells = {}          # (level, facing) -> (x0, y0, x1, y1) in master coords
    ground = 0
    for li, (num, nf) in enumerate(LEVELS):
        runs = facings_of(sheets[(num, 1)][1])
        if len(runs) != FACINGS:
            raise SystemExit(f'{num}: found {len(runs)} facings, expected {FACINGS}')
        for fa, (cx0, cx1) in enumerate(runs):
            # The union over this cell's boil frames -- see the header.
            x0, y0, x1, y1 = cx0, 10 ** 9, cx1, -1
            for fi in range(1, nf + 1):
                m = sheets[(num, fi)][1][:, cx0:cx1 + 1]
                r = rows_of(m)
                if r is None:
                    raise SystemExit(f'{num} F{fi} facing {fa}: no ink')
                y0, y1 = min(y0, r[0]), max(y1, r[1])
                cols = np.nonzero(m.any(axis=0))[0]
                x0 = min(x0, cx0 + int(cols.min()))
                x1 = max(x1, cx0 + int(cols.max()))
            cells[(li, fa)] = (x0, y0, x1, y1)
            ground = max(ground, y1)

    # ---- one scale, off level 1 (index 1), facing 0 -------------------------
    ref = cells[(1, 0)]
    scale = TARGET_H / float(ref[3] - ref[1] + 1)

    # ---- cut, scale, pack ---------------------------------------------------
    tiles = []
    # index[level][state][facing]; null where a level has no such state.
    index = [[[None] * FACINGS for _ in STATE_NAMES] for _ in LEVELS]
    for li, (num, nf) in enumerate(LEVELS):
        for fa in range(FACINGS):
            x0, y0, x1, y1 = cells[(li, fa)]
            w, h = x1 - x0 + 1, y1 - y0 + 1
            sw, sh = max(1, round(w * scale)), max(1, round(h * scale))
            for fi in range(1, nf + 1):
                t = sheets[(num, fi)][0].crop((x0, y0, x1 + 1, y1 + 1))
                index[li][fi - 1][fa] = len(tiles)
                tiles.append({
                    'img': t.resize((sw, sh), Image.LANCZOS),
                    # Shared by the cell's STATES: the drawn centre, and the
                    # pack's one ground row. See the header on both.
                    'ax': round((x0 + x1) / 2.0 - x0, 1) * scale,
                    'ay': (ground - y0) * scale,
                })

    # ONE ATLAS PER LEVEL. Roughly square, so neither dimension runs at the cap.
    frames = [None] * len(tiles)
    sheets_out = []
    for li in range(len(LEVELS)):
        ids = [fid for st in index[li] for fid in st if fid is not None]
        cols_n = max(1, int(round(len(ids) ** 0.5)))
        x = y = rowh = W = 0
        for n, fid in enumerate(ids):
            if n % cols_n == 0 and n:
                y += rowh + PAD
                x, rowh = 0, 0
            im = tiles[fid]['img']
            tiles[fid]['x'], tiles[fid]['y'] = x, y
            rowh = max(rowh, im.height)
            x += im.width + PAD
            W = max(W, x)
        H = y + rowh + PAD
        if W > MAX_DIM or H > MAX_DIM:
            raise SystemExit(
                f'level {li} atlas is {W}x{H}, over MAX_DIM {MAX_DIM}. '
                f'Lower TARGET_H (now {TARGET_H}) or split further.')
        atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for fid in ids:
            t = tiles[fid]
            atlas.paste(t['img'], (t['x'], t['y']))
            frames[fid] = {'sheet': li, 'x': t['x'], 'y': t['y'],
                           'w': t['img'].width, 'h': t['img'].height,
                           'ax': round(t['ax'], 1), 'ay': round(t['ay'], 1)}
        name = f'{OUT}-L{li}'
        atlas.save(name + '-game.png')
        sheets_out.append(os.path.basename(name))
        print(f'  {os.path.basename(name)}-game.png  {W}x{H}  {len(ids)} frames, '
              f'{os.path.getsize(name + "-game.png") / 1024:.0f} KB')
    with open(OUT + '-sprites.json', 'w') as fh:
        json.dump({'scale': round(scale, 5), 'ground': ground,
                   'levels': len(LEVELS), 'states': STATE_NAMES,
                   'facings': FACINGS, 'sheets': sheets_out,
                   'frames': frames, 'index': index}, fh)

    total = sum(os.path.getsize(f'{OUT}-L{i}-game.png') for i in range(len(LEVELS)))
    print(f'{len(frames)} frames over {len(sheets_out)} atlases, '
          f'{total / 1024 / 1024:.1f} MB total')
    print(f'  scale {scale:.5f}   ground row {ground}   TARGET_H {TARGET_H}')
    for li, (num, nf) in enumerate(LEVELS):
        f0 = frames[index[li][0][0]]
        have = [STATE_NAMES[si] for si in range(len(STATE_NAMES))
                if index[li][si][0] is not None]
        print(f'  level {li} ({num})  facing0 {f0["w"]}x{f0["h"]}'
              f'  anchor {f0["ax"]},{f0["ay"]}  states: {", ".join(have)}')


if __name__ == '__main__':
    main()
