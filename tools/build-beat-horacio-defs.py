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

THEN NINE MORE ARRIVED (2026-09-03), in damage-sprites/, named
batidao-boss-espeto-hit-<level>-F<n>: the RECOIL of each body, the frame he
wears for the moment a punch lands. Their F numbering is its OWN, compacted,
and reading it as the main pack's is the mistake to avoid:

    hit F1  armoured recoil   eyes screwed shut ">  <"
    hit F2  exposed recoil    the same squint over gritted yellow teeth
    hit F3  naked recoil      LEVEL 001 ONLY -- so hit-F3 is the NAKED body,
                              NOT the ball, even though plain F3 is the ball.

⚠️ THERE IS NO HIT POSE FOR THE BALL, at any level, and that is the art being
right: a tucked ball has no face to screw up. 4 levels x 2 + 1 = the nine files.
He can still be punched while balled (the peek is the fight's one opening), and
there he keeps the ball drawing and says the hit with the blink alone.

THEN SEVEN MORE (2026-09-04), `-especial-<level>-F<n>`: THE SUMMON POSE, the
hand he raises to call the charutobis -- the drawing beat 8 had been running
without. Two things about them are not like the other two packs:

    ⚠️ ONE FACING, NOT EIGHT. The master is the same 13443x2371 canvas but only
    the FIRST cell is drawn; the other seven are empty. That is correct and not
    a partial delivery -- he is scripted to turn and face the camera for this
    beat (`SUMMON.signalFacing: 0`), so the seven he cannot be in were never
    worth drawing. So these states exist at facing 0 and are null everywhere
    else, and the loop below only offers them to facing 0.

    ⚠️ THEIR F NUMBERING FOLLOWS THE **MAIN** PACK, NOT THE HIT PACK'S. F1
    armoured, F2 exposed, **F4 naked** -- F3 is skipped rather than compacted,
    because a tucked ball has no hand to raise, exactly as it has no face to
    screw up. The hit pack compacts (its F3 IS the naked body); this one does
    not. The two conventions sit in one folder and only the filenames tell them
    apart.

    ⚠️ AND THERE IS NO 004. The grandao does not summon -- `enterLevel` is 1 and
    only the STAB borrows level 3 -- so the combinations that can actually reach
    the summon are (1, armoured), (1, exposed) and (0, naked). 003's pair is
    drawn ahead of a tier that does not exist yet; a missing one falls back to
    the ordinary body rather than to a blank.

⚠️ THE SUMMON POSE IS WIDER THAN THE BODY IT REPLACES -- about 70 master px
further left and 90 further right, because the raised arm leaves the silhouette
-- so it widens facing 0's cell in every level. That is safe for exactly the
reason the recoils were: `ax` and `ground` are measured off the NORMAL bodies
alone, so a wider cell adds transparent margin and moves nothing. Its FEET were
checked against the normal facing-0 cell before any of this was wired: -5 to +6
master px across all seven, so it shares the pack's ground line as drawn.

⚠️ AND THE HIT FRAMES DO NOT SHARE THE MAIN PACK'S CELL RUNS EXACTLY. Three of
level 001's eight start up to 28 master px LEFT of the corresponding normal run
-- the recoil leans -- so slicing them at the normal runs would shave a strip
off the pose. The window is the UNION of the two sheets' runs. But see
`ax` below: widening a cell moves its centre, and the centre IS the anchor, so
the anchor is measured from the NORMAL frames only and every existing drawing
stays exactly where it was.

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
                        state 0 armoured, 1 exposed, 2 ball, 3 naked,
                              4 armoured_hit, 5 exposed_hit, 6 naked_hit,
                              7 summon_armoured, 8 summon_exposed,
                              9 summon_naked.
                        ⚠️ ONLY LEVEL 0 HAS STATES 3, 6 AND 9; NO LEVEL HAS A
                        HIT BALL OR A SUMMONING BALL; LEVEL 3 HAS NO SUMMON AT
                        ALL; and 7/8/9 exist at FACING 0 ONLY. Those hold null,
                        so a lookup must fall back rather than index blindly.
"""
import json
import os

import numpy as np
from PIL import Image

SRC = 'assets-v2/beatemup-dungeon/boss_horacio/batidao-boss-espeto-%s-F%d.png'
HIT = ('assets-v2/beatemup-dungeon/boss_horacio/damage-sprites/'
       'batidao-boss-espeto-hit-%s-F%d.png')
SPECIAL = ('assets-v2/beatemup-dungeon/boss_horacio/'
           'batidao-boss-espeto-especial-%s-F%d.png')
OUT = 'assets-v2/beatemup-dungeon/horacio'
# (sheet number, how many BODIES it has, how many HIT bodies it has).
# Order IS the level order.
LEVELS = [('001', 4, 3), ('002', 3, 2), ('003', 3, 2), ('004', 3, 2)]
# ⚠️ THE HIT STATES ARE APPENDED, NEVER INTERLEAVED. `state` is stored in the
# JSON and read by horacio-boss.js as a number; inserting `armoured_hit` next to
# `armoured` would renumber `ball` and `naked` and silently repoint every lookup
# in that file. Adding on the end is the only edit that cannot do that.
STATE_NAMES = ['armoured', 'exposed', 'ball', 'naked',
               'armoured_hit', 'exposed_hit', 'naked_hit',
               'summon_armoured', 'summon_exposed', 'summon_naked']
# hit file F<n> -> state index. See the header: hit F3 is the NAKED recoil.
HIT_STATE = {1: 4, 2: 5, 3: 6}
# especial file F<n> -> state index. ⚠️ F4, NOT F3: this pack follows the MAIN
# pack's numbering and skips the ball, where the hit pack compacts. See header.
SPECIAL_STATE = {1: 7, 2: 8, 4: 9}
# which especial files each level actually has. ⚠️ 004 HAS NONE, ON PURPOSE.
SPECIAL_F = {'001': [1, 2, 4], '002': [1, 2], '003': [1, 2], '004': []}
# ⚠️ THE SUMMON POSE IS DRAWN FOR ONE FACING. See the header.
SPECIAL_FACING = 0
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
    # ---- load every master once, normal and hit -----------------------------
    # keyed (level number, state index) -- the SAME numbering the JSON stores,
    # so nothing downstream has to know which file a body came out of.
    sheets = {}
    for num, nf, nh in LEVELS:
        for fi in range(1, nf + 1):
            path = SRC % (num, fi)
            if not os.path.exists(path):
                raise SystemExit(f'missing {path}')
            im = Image.open(path).convert('RGBA')
            sheets[(num, fi - 1)] = (im, np.array(im)[:, :, 3] > ALPHA)
        for fi in range(1, nh + 1):
            path = HIT % (num, fi)
            if not os.path.exists(path):
                raise SystemExit(f'missing {path}')
            im = Image.open(path).convert('RGBA')
            sheets[(num, HIT_STATE[fi])] = (im, np.array(im)[:, :, 3] > ALPHA)
        for fi in SPECIAL_F.get(num, []):
            path = SPECIAL % (num, fi)
            if not os.path.exists(path):
                raise SystemExit(f'missing {path}')
            im = Image.open(path).convert('RGBA')
            sheets[(num, SPECIAL_STATE[fi])] = (im, np.array(im)[:, :, 3] > ALPHA)

    def states_of(num, nf, nh):
        """The states that SHARE a level/facing cell: the bodies and their recoils.

        ⚠️ THE SUMMON STATES ARE DELIBERATELY NOT IN HERE. They get their own
        crop rect -- see `srects` below for why that is not a departure from the
        one-rect-per-cell rule but the thing that rule was protecting.
        """
        return [si for si in range(nf)] + [HIT_STATE[fi] for fi in range(1, nh + 1)]

    cells = {}          # (level, facing) -> (x0, y0, x1, y1) in master coords
    # (level, facing) -> the NORMAL frames' own bounds (x0, x1, y0, y1).
    # ⚠️ THE ANCHOR AND THE SCALE BOTH COME FROM THIS, NOT FROM THE CELL --
    # see the notes where `ax` and `scale` are computed.
    body = {}
    ground = 0
    for li, (num, nf, nh) in enumerate(LEVELS):
        # ⚠️ THE WINDOW IS THE UNION OF THE TWO SHEETS' RUNS. A few recoil poses
        # lean out past the normal run's left edge and slicing at the normal one
        # would shave the pose. Both sheets give eight runs in the same order --
        # asserted, because a merged or split run would silently pair facing 3
        # with facing 4 and h-flip half his fight.
        runs = facings_of(sheets[(num, 0)][1])
        if len(runs) != FACINGS:
            raise SystemExit(f'{num}: found {len(runs)} facings, expected {FACINGS}')
        hruns = facings_of(sheets[(num, HIT_STATE[1])][1])
        if len(hruns) != FACINGS:
            raise SystemExit(f'{num} hit: found {len(hruns)} facings, expected {FACINGS}')
        for fa in range(FACINGS):
            cx0 = min(runs[fa][0], hruns[fa][0])
            cx1 = max(runs[fa][1], hruns[fa][1])
            # The union over every body in this cell -- see the header.
            x0, y0, x1, y1 = 10 ** 9, 10 ** 9, -1, -1
            bx0, bx1, by0, by1 = 10 ** 9, -1, 10 ** 9, -1
            for si in states_of(num, nf, nh):
                m = sheets[(num, si)][1][:, cx0:cx1 + 1]
                r = rows_of(m)
                if r is None:
                    raise SystemExit(f'{num} state {si} facing {fa}: no ink')
                cols = np.nonzero(m.any(axis=0))[0]
                lo, hi = cx0 + int(cols.min()), cx0 + int(cols.max())
                y0, y1 = min(y0, r[0]), max(y1, r[1])
                x0, x1 = min(x0, lo), max(x1, hi)
                if si < 4:
                    bx0, bx1 = min(bx0, lo), max(bx1, hi)
                    by0, by1 = min(by0, r[0]), max(by1, r[1])
            # ⚠️ THE GROUND ROW IS THE NORMAL BODIES' ONLY (`by1`, not `y1`).
            # Every recoil sits higher than the pose it replaces -- he flinches
            # UP -- so letting them into this max is harmless today and would
            # move the whole pack's ground line, and therefore every `ay` in it,
            # the first time one did not. The ground is where he STANDS.
            ground = max(ground, by1)
            cells[(li, fa)] = (x0, y0, x1, y1)
            body[(li, fa)] = (bx0, bx1, by0, by1)

    # ---- the summon poses get their OWN rect, and that is the point ---------
    # ⚠️ THIS IS NOT A BREACH OF "ONE CROP RECT PER (LEVEL, FACING)", IT IS WHAT
    # THAT RULE EXISTS FOR. The rule is there so a state change does not MOVE
    # him -- and what actually holds him still is the shared BODY CENTRE and the
    # shared GROUND ROW, both of which these tiles keep. The crop rect itself
    # cancels out of the drawn position algebraically: the renderer puts ink at
    # `(col - bodyCentre) * scale` and `(row - ground) * scale`, in which x0 and
    # y0 appear once with each sign.
    #
    # ⚠️ AND SHARING THE CELL WAS TRIED FIRST AND MEASURABLY MOVED THE SHIPPED
    # ART. The summon pose is ~70 px wider on each side, so folding it into
    # facing 0's cell grew that cell -- and every OTHER state at facing 0 then
    # resampled on a different sub-pixel phase. Measured against the committed
    # atlases: the drawn ink shifted up to **3.5 px** on 17 frames, for a change
    # that is supposed to be invisible until he summons. Its own rect is 0.00.
    srects = {}
    for li, (num, nf, nh) in enumerate(LEVELS):
        for fi in SPECIAL_F.get(num, []):
            si = SPECIAL_STATE[fi]
            m = sheets[(num, si)][1]
            r = facings_of(m)
            if len(r) != 1:
                raise SystemExit(f'{num} especial F{fi}: found {len(r)} runs, '
                                 f'expected 1 -- is it an eight-facing master?')
            cx0, cx1 = r[0]
            rr = rows_of(m[:, cx0:cx1 + 1])
            if rr is None:
                raise SystemExit(f'{num} especial F{fi}: no ink')
            srects[(li, si)] = (cx0, rr[0], cx1, rr[1])
            # ⚠️ ITS FEET MUST MATCH THE ONES IT REPLACES, and this is the only
            # thing that can silently ruin the pose: `ay` is measured down to the
            # pack's ground row, so a master drawn 200 px higher would simply
            # hang in the air with no error anywhere.
            #
            # ⚠️ AGAINST FACING 0's OWN FEET, **NOT** AGAINST `ground`, and
            # writing it the other way is what this check caught first time out.
            # `ground` (1874) is the pack-wide row -- the lowest legs in any
            # facing of any level -- and facing 0 is a head-on pose whose legs
            # sit about 53 px ABOVE it, exactly as the header says they should.
            # Comparing the summon pose to `ground` flagged a 50 px error in art
            # that is registered to within 3 px of what it replaces.
            feet = body[(li, SPECIAL_FACING)][3]
            if abs(rr[1] - feet) > 40:
                raise SystemExit(
                    f'{num} especial F{fi}: feet at row {rr[1]}, but facing '
                    f'{SPECIAL_FACING} of this level stands on {feet} -- it '
                    f'would float or sink')

    # ---- one scale, off level 1 (index 1), facing 0 -------------------------
    # ⚠️ OFF THE **BODY**, NOT THE CELL, AND THAT IS NOT A REFACTOR. It read the
    # cell until the recoils were added, and they reach 7 master rows higher
    # than the pose they replace, so the cell grew and the same TARGET_H came
    # out as scale 0.31749 instead of 0.31949: the ENTIRE boss, every level and
    # every state, 0.6% smaller because a hurt frame arrived. `TARGET_H` is
    # documented as the level-1 BODY height on screen and now measures one.
    ref = body[(1, 0)]
    scale = TARGET_H / float(ref[3] - ref[2] + 1)

    # ---- cut, scale, pack ---------------------------------------------------
    tiles = []
    # index[level][state][facing]; null where a level has no such state.
    index = [[[None] * FACINGS for _ in STATE_NAMES] for _ in LEVELS]
    for li, (num, nf, nh) in enumerate(LEVELS):
        for fa in range(FACINGS):
            x0, y0, x1, y1 = cells[(li, fa)]
            bx0, bx1 = body[(li, fa)][0], body[(li, fa)][1]
            w, h = x1 - x0 + 1, y1 - y0 + 1
            sw, sh = max(1, round(w * scale)), max(1, round(h * scale))
            for si in states_of(num, nf, nh):
                t = sheets[(num, si)][0].crop((x0, y0, x1 + 1, y1 + 1))
                index[li][si][fa] = len(tiles)
                tiles.append({
                    'img': t.resize((sw, sh), Image.LANCZOS),
                    # ⚠️ THE DRAWN CENTRE OF THE **NORMAL** BODIES, NOT OF THE
                    # CELL. `ax` is what the renderer subtracts from his ground
                    # x, so it IS the cell's centre by construction -- and the
                    # hit sheets widened some cells asymmetrically (up to 28
                    # master px on one side). Measuring it off the cell would
                    # have slid the whole boss a few pixels sideways the day the
                    # recoils were added, in a change that is supposed to be
                    # invisible until he is punched. Pinning it to the bodies
                    # keeps every existing drawing on the exact pixel it was on.
                    'ax': ((bx0 + bx1) / 2.0 - x0) * scale,
                    # ...and the pack's one ground row. Independent of `y0`:
                    # a taller cell raises `y0` and `ay` together and the drawn
                    # position does not move. See the header.
                    'ay': (ground - y0) * scale,
                })
        # THE SUMMON POSES, at their own rect and at facing 0 only. Same shared
        # body centre, same shared ground row -- see `srects`.
        for fi in SPECIAL_F.get(num, []):
            si = SPECIAL_STATE[fi]
            sx0, sy0, sx1, sy1 = srects[(li, si)]
            bx0, bx1 = body[(li, SPECIAL_FACING)][0], body[(li, SPECIAL_FACING)][1]
            w, h = sx1 - sx0 + 1, sy1 - sy0 + 1
            t = sheets[(num, si)][0].crop((sx0, sy0, sx1 + 1, sy1 + 1))
            index[li][si][SPECIAL_FACING] = len(tiles)
            tiles.append({
                'img': t.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                                Image.LANCZOS),
                'ax': ((bx0 + bx1) / 2.0 - sx0) * scale,
                'ay': (ground - sy0) * scale,
            })

    # ONE ATLAS PER LEVEL. ⚠️ THE COLUMN COUNT IS SEARCHED, NOT `sqrt(n)`, since
    # the recoils went in: sqrt is only square when the tiles are, and at level 3
    # a 6-column shelf packs to 3220 tall -- twenty pixels over MAX_DIM, for a
    # pack that fits comfortably at 7. Trying every count and keeping the one
    # with the smallest longest side costs nothing at build time.
    frames = [None] * len(tiles)
    sheets_out = []
    for li in range(len(LEVELS)):
        ids = [fid for st in index[li] for fid in st if fid is not None]

        def shelf(cols_n):
            x = y = rowh = W = 0
            place = {}
            for n, fid in enumerate(ids):
                if n % cols_n == 0 and n:
                    y += rowh + PAD
                    x, rowh = 0, 0
                im = tiles[fid]['img']
                place[fid] = (x, y)
                rowh = max(rowh, im.height)
                x += im.width + PAD
                W = max(W, x)
            return W, y + rowh + PAD, place

        best = min((shelf(c) for c in range(1, len(ids) + 1)),
                   key=lambda r: (max(r[0], r[1]), r[0] * r[1]))
        W, H, place = best
        if W > MAX_DIM or H > MAX_DIM:
            raise SystemExit(
                f'level {li} atlas is {W}x{H}, over MAX_DIM {MAX_DIM}. '
                f'Lower TARGET_H (now {TARGET_H}) or split further.')
        atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for fid in ids:
            t = tiles[fid]
            x, y = place[fid]
            atlas.paste(t['img'], (x, y))
            frames[fid] = {'sheet': li, 'x': x, 'y': y,
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
    # ⚠️ `bodyPx` IS WHAT `CONFIG.HORACIO_BOSS.sizeByLevel` TAKES, NOT the tile
    # height beside it. The tile is the shared cell and now covers the recoils
    # too, so it runs a few px taller than he is; sizeByLevel feeds the HURTBOX,
    # and a hurtbox that grew because a hurt POSE reaches higher is a box around
    # air. It is the body, at this scale, as it always was.
    print('  sizeByLevel: [' + ', '.join(
        str(round((body[(li, 0)][3] - body[(li, 0)][2] + 1) * scale))
        for li in range(len(LEVELS))) + ']')
    for li, (num, nf, nh) in enumerate(LEVELS):
        f0 = frames[index[li][0][0]]
        bpx = round((body[(li, 0)][3] - body[(li, 0)][2] + 1) * scale)
        have = [STATE_NAMES[si] for si in range(len(STATE_NAMES))
                if index[li][si][0] is not None]
        print(f'  level {li} ({num})  facing0 tile {f0["w"]}x{f0["h"]}'
              f'  bodyPx {bpx}  anchor {f0["ax"]},{f0["ay"]}'
              f'  states: {", ".join(have)}')


if __name__ == '__main__':
    main()
