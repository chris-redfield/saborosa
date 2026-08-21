#!/usr/bin/env python3
"""Cut a beat 'em up VILLAIN sheet into a packed atlas + defs.

Sibling of tools/build-beat-coconut-defs.py, and most of the machinery is the
same: the sheets are ragged, not grids, so every frame is found by its own
content bbox, frames are deduped on mean absolute difference, and each one
carries an ANCHOR rather than being centred on its bbox. Read that file's
header for why any of that is the way it is.

WHY THIS IS A SECOND TOOL RATHER THAN A FLAG ON THAT ONE. These sheets have a
part the coconut does not: SMOKE. It rises off the ember, it is drawn in the
same white as the body, and it is a third of the frame's height. Everything
below exists because of it, and none of it applies to the coconut:

  * THE SMOKE IS NOT THE CHARACTER, so it must not size him. `sheets.js` scales
    a pack so its idle frame is `fighterSizePx` tall; done on the raw frame that
    makes a cigarette two thirds the height of everyone else, with a plume where
    his head should be. The defs therefore carry `bodyH` -- the idle frame's
    height WITHOUT the smoke -- and the pack scales on that instead.

  * THE SMOKE IS NOT THE BODY EITHER, so it must not move the anchor. It is
    white, and the body is white, so a colour test cannot tell them apart. What
    separates them is that the smoke is DETACHED: the body is the connected
    component containing the lowest opaque pixel, and every floating wisp and
    puff is some other component. That test needs no threshold and no palette.

  * THE SHEET IS CUT ON BODIES, NOT ON INK, and this is the part that took a
    second sheet to learn. The first cutter banded rows and split frames on
    empty pixel rows and columns, which works only while nothing reaches out of
    its own frame. The second cigarette's smoke does: it BRIDGES TWO PAIRS OF
    ROWS vertically and WELDS TWO FRAMES horizontally, so that method found 6
    row bands where the art has 8, and one 534px-wide frame that was two.
    No gap threshold fixes it -- the pixels genuinely touch.

    So the sheet is labelled into connected components first, and the ones over
    `BODY_AREA` are the characters. Measured on both sheets: every body is at
    least 36000px and every wisp at most 6400, a gap of 5.8x, and each sheet has
    exactly 44 bodies for its 44 frame slots. Rows and frames are then found on
    the BODIES ALONE, which cannot touch each other, and every loose wisp is
    given back to the body it rises from.

  * FRAME RECTANGLES OVERLAP once smoke is included, so each tile is MASKED to
    its own components rather than cropped out of the sheet. Cropping would
    carry a neighbour's plume into the tile, and it would be drawn in game
    attached to the wrong character.

  * THE FRAMES ARE TALLER THAN THEY LOOK, so the health bar needs telling.
    hud.js floats an enemy's bar above `size().h`; on the raw frame it hovers a
    plume's height over an empty patch of sky. Each frame carries `bh`, the
    body's height above its own anchor, and `size()` reports that.

THE ANCHOR IS THE BASE, NOT THE WHOLE BODY. The coconut's anchor is the
centroid of its whole body; a cigarette is a long thing that LEANS, and on the
lunging punch the top of him travels most of a body-width forward. Taking the
centroid of all of him would slide the feet backwards to pay for the lean --
the punch would visibly cost reach. So the horizontal anchor is read off the
bottom `BASE_FRAC` of him only: the part standing on the belt.

Row meanings are the illustrator's, 1-indexed as given (see SHEETS below).

Usage:  python3 tools/build-beat-enemy-defs.py cigarro

Outputs (assets-v2/beatemup-dungeon/), named to the main game's character-pack
convention so manifest.js loads them with the same two lines as every other
pack:
  <base>-game.png       packed atlas, downscaled by SCALE
  <base>-sprites.json   { scale, native, bodyH, frames:[{x,y,w,h,ax,ay,bh}],
                          anims:{name:[..]} }
"""
import json
import sys

import numpy as np
from PIL import Image

OUT = 'assets-v2/beatemup-dungeon/'

# Default atlas downscale, overridable per sheet. Same bargain as the coconut's
# but measured on the BODY rather than the frame: a fighter draws 137px tall
# (fighterSizePx) and this aims to leave the atlas about 170px of body to draw
# him from, so the sprite is always downscaled and never stretched while the
# texture stays near the coconut's. The two sheets are drawn at different sizes,
# which is why it is a per-sheet number -- match `body` in the tool's output, not
# this constant. See PERFORMANCE.md for what happens when textures get away.
SCALE = 0.49
PAD = 2            # transparent gutter between packed frames
ALPHA = 8          # alpha above this counts as content
# Smallest component that counts as a CHARACTER rather than a puff of smoke.
# Not a fine judgement: measured across both sheets, the smallest body is
# 36417px and the largest wisp 6312px, so anything between them separates them.
# The tool asserts the body count against the row table, so a sheet this is
# wrong for fails loudly instead of cutting something plausible.
BODY_AREA = 15000
# Applied to the BODY MASK, not to the ink -- see the header. Bodies never touch
# each other on either sheet, so both can stay at their tightest.
BAND_GAP = 2       # empty rows tolerated inside one row band
GAP = 0            # empty columns tolerated inside one frame
SAME = 2.5         # mean abs channel difference below which two frames are one
SIZE_TOL = 2       # px of width/height difference tolerated when matching

# How many pixels of body a row needs before it counts as the bottom. Guards
# against an antialiased tail hanging one pixel below the feet and planting the
# character that much into the floor.
BODY_MIN_RUN = 6
# The fraction of the body, measured up from its feet, that counts as its BASE
# for the horizontal anchor. See the header: a leaning body must not drag its
# own feet backwards.
BASE_FRAC = 0.30
# The body's own white, for the base centroid. Excludes the tan limbs, so a
# punching arm cannot pull the feet sideways.
WHITE_TOL = 60

SHEETS = {
    # (name, human row number, expected frame count). The illustrator's list.
    'cigarro': {
        'src': 'assets-v2/beatemup-dungeon/cigarro-sprites-fim.png',
        'base': 'cigarro-beat',
        # Drawn facing RIGHT, like the coconut's sheet and unlike the main
        # game's packs. Recorded rather than assumed: getting it wrong does not
        # error, the character simply walks backwards for a whole build.
        'native': 'right',
        'rows': [
            ('idle',      1, 3),   # respirando
            ('walk',      2, 6),   # andando
            ('jump',      3, 6),   # pulando
            ('airPunch',  4, 7),   # pulando e socando
            ('combo',     5, 6),   # socando -- three wind-up/strike PAIRS
            ('hurt',      6, 2),   # apanhando; both frames cycle
            ('knockdown', 7, 6),   # cai no chao e levanta -- land, lie, rise
            ('death',     8, 8),   # morrendo
        ],
    },
    # The stub: a shorter, fatter, tan cigarette with yellow gloves. SAME EIGHT
    # ROWS, same counts, same order -- the illustrator drew the pair to one
    # plan, which is why the whole entry is a copy with two paths changed.
    'cigarro2': {
        'src': 'assets-v2/beatemup-dungeon/cigarro2-sprites-fim.png',
        'base': 'cigarro2-beat',
        'native': 'right',
        # He is drawn BIGGER than the first one -- 198px of body at the shared
        # 0.49 against his 170 -- so his own scale brings the atlas back to the
        # same ~170px of body per fighter. Sizing is `bodyH` in the defs, not
        # this, but leaving it at 0.49 would ship a third more texture for a
        # sprite drawn at exactly the same size on screen.
        'scale': 0.42,
        'rows': [
            ('idle',      1, 3),
            ('walk',      2, 6),
            ('jump',      3, 6),
            ('airPunch',  4, 7),
            ('combo',     5, 6),
            ('hurt',      6, 2),
            ('knockdown', 7, 6),
            ('death',     8, 8),
        ],
    },
    # The THIRD cigarette, and the third drawing of one plan: same 3487x6243
    # sheet, same eight rows, same counts, same order. The entry is a copy with
    # one path changed for exactly that reason -- if a future sheet ever breaks
    # the plan, the cutter says so rather than guessing (it counts bodies and
    # row bands against `rows` and refuses to run when they disagree).
    'cigarro3': {
        'src': 'assets-v2/beatemup-dungeon/cigarro3-sprites-fim.png',
        'base': 'cigarro3-beat',
        'native': 'right',
        # Drawn at the STUB's size, not the first cigarette's: 198.4px of body
        # at the shared 0.49 against cigarro's 170. Same reason and same number
        # as cigarro2 -- the atlas comes back to ~170px of body per fighter, so
        # a sprite drawn at the same on-screen size does not ship a third more
        # texture than it needs. Sizing in game is `bodyH` in the defs, never
        # this.
        'scale': 0.42,
        'rows': [
            ('idle',      1, 3),
            ('walk',      2, 6),
            ('jump',      3, 6),
            ('airPunch',  4, 7),
            ('combo',     5, 6),
            ('hurt',      6, 2),
            ('knockdown', 7, 6),
            ('death',     8, 8),
        ],
    },

    # THE BARATAS -- a different animal, and a shorter sheet.
    # Six rows, not eight: no jump and no separate knockdown, because a
    # cockroach does neither. What it has instead is row 6, the BALL -- it curls
    # up and charges.
    #
    # ROW 5 REUSES ROW 4's TWO DRAWINGS as its first two frames, which is the
    # illustrator's plan and was stated when the sheet was delivered. The cutter
    # dedupes on mean absolute difference, so those two pack ONCE and both rows
    # index the same tiles. That is the intended outcome, not a bug to chase:
    # `death` and `hurt` genuinely share their opening.
    'barata': {
        'src': 'assets-v2/beatemup-dungeon/barata-coconutbash.png',
        'base': 'barata-beat',
        'native': 'right',
        # Drawn BIG: 342.5px of body at the shared 0.49, twice the first
        # cigarette's 170. Same rule as the cigarettes -- bring the atlas back
        # to ~170px of body, because `sheets.js` scales every pack so its idle
        # body is `fighterSizePx` tall and a source drawn 2.5x over that is
        # 2.5x of texture being thrown away on every draw. Sizing in game is
        # `bodyH` in the defs, never this.
        'scale': 0.24,
        'rows': [
            ('idle',   1, 4),
            ('walk',   2, 5),
            ('combo',  3, 5),   # a guard frame, then four strike poses
            ('hurt',   4, 2),   # both frames cycle, as the cigarettes' do
            ('death',  5, 3),   # frames 1-2 are the hurt pair again
            ('ball',   6, 5),   # curls up, then spins -- the charge
        ],
    },
    # The red one. Same six rows, same counts, same order -- the pair was drawn
    # to one plan exactly as the cigarettes were.
    'barata2': {
        'src': 'assets-v2/beatemup-dungeon/barata2-coconutbash.png',
        'base': 'barata2-beat',
        'native': 'right',
        # Drawn BIG: 342.5px of body at the shared 0.49, twice the first
        # cigarette's 170. Same rule as the cigarettes -- bring the atlas back
        # to ~170px of body, because `sheets.js` scales every pack so its idle
        # body is `fighterSizePx` tall and a source drawn 2.5x over that is
        # 2.5x of texture being thrown away on every draw. Sizing in game is
        # `bodyH` in the defs, never this.
        'scale': 0.24,
        'rows': [
            ('idle',   1, 4),
            ('walk',   2, 5),
            ('combo',  3, 5),
            ('hurt',   4, 2),
            ('death',  5, 3),
            ('ball',   6, 5),
        ],
    },
    # THE HORSE BOSS, and the first thing through this cutter that is not a
    # cigarette. Five rows, 55 frames, named by the illustrator in one line.
    #
    # IT ARRIVED AT 27329x7922 AND 18MB and was reduced to a quarter before it
    # came anywhere near here -- see tools/shrink-master.py. Do not re-cut from
    # an unreduced export and expect any of these numbers to hold.
    #
    # `scale` IS 1.0 BECAUSE THE MASTER IS ALREADY THE RIGHT SIZE. The others
    # carry 0.42-0.49 to bring a print-resolution sheet down to ~170px of body.
    # The horse's master was reduced once, permanently, so a second reduction
    # here would throw away half of what is left.
    #
    # `baseWhite` IS FALSE: he is chrome and gold, not white, and the white
    # anchor test does NOT fall back on him -- see anchor().
    #
    # `bodyArea` IS LOWERED because his smallest frames sit just under the
    # shared 15000, which was measured on the cigarettes.
    #
    # HE FACES RIGHT in rows 1-4, like the coconut and the cigarettes. ROW 5 IS
    # THE EXCEPTION AND IT IS NOT A FACING: `turn` runs profile-left (frame 0)
    # through head-on (frame 3) to profile-right (frame 6), the same shape as
    # MOSCA_RECTS. Whatever draws it must index it directly and must NOT let the
    # pack's mirror touch it, or the turn folds in half.
    #
    # THERE IS NO hurt, knockdown OR death ROW, and that is deliberate --
    # confirmed by the user. He takes damage the way the Mosca does: a flash, a
    # blink, and the impact burst on top. Do not invent one out of these rows.
    'horse': {
        'src': 'assets-v2/beatemup-dungeon/horse-coconutbash.png',
        'base': 'horse-beat',
        'native': 'right',
        'scale': 1.0,
        'baseWhite': False,
        'bodyArea': 1000,
        'refAnim': 'walk',
        'rows': [
            ('runAttack', 1, 12),  # ataque correndo
            ('trot',      2, 12),  # trotando
            ('walk',      3, 12),  # caminhando
            ('kick',      4, 12),  # coice
            ('turn',      5,  7),  # parado virando -- a TURN, not a facing
        ],
    },
}


def components(mask):
    """Connected components (8-way), as (labels, stats).

    `labels` is a per-pixel int array; `stats` maps label -> [y0,y1,x0,x1,area].

    Written by ROW RUNS with a union-find rather than a per-pixel flood, because
    these sheets are 3500x6300 and a Python-level flood over them takes minutes.
    scipy.ndimage would do it in one call and is deliberately not used: it is not
    importable in this environment, and none of the other tools in this repo need
    it either.
    """
    h, w = mask.shape
    parent = [0]

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    rows, prev = [], []
    for y in range(h):
        edges = np.flatnonzero(np.diff(np.concatenate(
            ([0], mask[y].view(np.int8), [0]))))
        cur = []
        for i in range(0, len(edges), 2):
            a, b = int(edges[i]), int(edges[i + 1]) - 1
            lab = 0
            for (pa, pb, pl) in prev:
                if pa <= b + 1 and a <= pb + 1:      # 8-way: touching diagonally counts
                    if lab == 0:
                        lab = pl
                    else:
                        union(lab, pl)
            if lab == 0:
                parent.append(len(parent))
                lab = len(parent) - 1
            cur.append((a, b, lab))
        rows.append(cur)
        prev = cur

    labels = np.zeros((h, w), np.int32)
    stats = {}
    for y, cur in enumerate(rows):
        for (a, b, l) in cur:
            r = find(l)
            labels[y, a:b + 1] = r
            e = stats.get(r)
            if e is None:
                stats[r] = [y, y, a, b, b - a + 1]
            else:
                e[1] = y
                e[2] = min(e[2], a)
                e[3] = max(e[3], b)
                e[4] += b - a + 1
    return labels, stats


def runs(flags, gap):
    """Contiguous True runs, merging those separated by <= gap. Inclusive."""
    out, start = [], None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append([start, i - 1])
            start = None
    if start is not None:
        out.append([start, len(flags) - 1])
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] - 1 <= gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return merged


def body_mask(opaque):
    """The character inside one tile, without the smoke.

    THE TEST IS CONNECTEDNESS, NOT COLOUR, and that is the point. The smoke is
    the same white as the body, so no palette test can separate them -- but it
    is DETACHED, and it is small.

    ⚠️ THE BODY IS THE BIGGEST COMPONENT, NOT THE LOWEST ONE. Taking the
    component that owns the lowest opaque pixel is the obvious rule -- a
    cigarette stands on the belt and a wisp does not -- and it is wrong twice on
    the second sheet, in the frames where he picks himself up off the floor:
    there is a puff of smoke drawn BELOW him. The anchor was then read off that
    puff, so its bottom became the ground line and the character was drawn
    hanging in the air above it. The size test cannot make that mistake; on
    both sheets the smallest body outweighs the largest wisp by 5.8x.
    """
    if not opaque.any():
        return opaque
    labels, stats = components(opaque)
    big = max(stats, key=lambda l: stats[l][4])
    return labels == big


def anchor(tile, base_white=True):
    """Ground point and body height inside a tile.

    Returns (ax, ay, bh): the horizontal anchor, the ground line, and how tall
    the body is above that line -- all in tile pixels, all measured on the body
    only, with the smoke excluded by body_mask().

    `ax` is the centroid of the WHITE base -- the bottom BASE_FRAC of him, body
    white only, so neither a thrown arm (tan) nor a leaning head (black) can
    move his feet. See the header.

    ⚠️ `base_white=False` FOR ANY SHEET THAT IS NOT WHITE-BODIED, and the horse
    is why the switch exists. The white test is not self-checking: it falls back
    to the whole body only when it finds FEWER THAN 20 matching pixels, and the
    horse's chrome highlights give it ~530 scattered over the legs. So it would
    not fall back -- it would quietly anchor the animal on whichever leg
    happened to catch the most light, which moves frame to frame. A palette rule
    written for one character must be opt-in, not the default for every sheet
    that arrives afterwards.
    """
    a = np.array(tile)
    opaque = a[:, :, 3] > ALPHA
    body = body_mask(opaque)

    per_row = body.sum(axis=1)
    solid = np.nonzero(per_row >= BODY_MIN_RUN)[0]
    if not len(solid):
        solid = np.nonzero(per_row > 0)[0]
    top, bottom = int(solid.min()), int(solid.max()) + 1

    rgb = a[:, :, :3].astype(int)
    white = (body & (np.abs(rgb - 255).sum(axis=2) < WHITE_TOL)) if base_white \
        else body
    base_top = max(top, bottom - max(1, int(round((bottom - top) * BASE_FRAC))))
    base = white.copy()
    base[:base_top] = False
    base[bottom:] = False
    if base.sum() < 20:                 # a frame with no white base: take all of it
        base = body.copy()
        base[:base_top] = False
        base[bottom:] = False
    ys, xs = np.nonzero(base)
    return float(xs.mean()), float(bottom), float(bottom - top)


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else 'cigarro'
    spec = SHEETS.get(which)
    if not spec:
        raise SystemExit(f'unknown sheet {which!r}; have {sorted(SHEETS)}')
    rows = spec['rows']

    im = Image.open(spec['src']).convert('RGBA')
    px = np.array(im)
    a = px[:, :, 3] > ALPHA
    want_total = sum(n for _, _, n in rows)

    # THE SHEET IS CUT ON BODIES, NOT ON INK -- see the module header.
    labels, stats = components(a)
    # PER SHEET, because the constant was measured on the cigarettes and the
    # horse's three smallest frames come in at 14539-14607 -- just UNDER it.
    # That fails loudly (the count will not match) rather than silently, which
    # is the tool working as intended; the fix is still to say so per sheet
    # rather than to keep lowering a shared number until it fits everything and
    # separates nothing. On the horse, dirt is 1-4px and the smallest body is
    # 14539, so 1000 sits in a gap 3000x wide.
    body_area = spec.get('bodyArea', BODY_AREA)
    bodies = {l: s for l, s in stats.items() if s[4] >= body_area}
    if len(bodies) != want_total:
        big = sorted((s[4] for s in stats.values()), reverse=True)
        raise SystemExit(
            f'expected {want_total} bodies over {body_area}px, found {len(bodies)}. '
            f'Areas around the cut: {big[max(0, want_total - 3):want_total + 3]}')

    body_px = np.isin(labels, list(bodies))
    bands = runs(body_px.any(axis=1), BAND_GAP)
    if len(bands) != len(rows):
        raise SystemExit(f'expected {len(rows)} rows, found {len(bands)}')

    tiles, anims = [], {}
    arrays = []                                 # np view of each packed tile

    def intern(tile):
        """Index of an equal-looking tile already packed, else pack this one.

        This is what makes the repeats free, and this sheet repeats a LOT: the
        first frames of the knockdown and death rows are the two hurt drawings
        again, so three rows share their opening.
        """
        n = np.array(tile).astype(int)
        for i, prev in enumerate(arrays):
            ph, pw = prev.shape[:2]
            if abs(ph - n.shape[0]) > SIZE_TOL or abs(pw - n.shape[1]) > SIZE_TOL:
                continue
            c = n if n.shape == prev.shape else np.array(
                tile.resize((pw, ph), Image.LANCZOS)).astype(int)
            if np.abs(prev - c).mean() < SAME:
                return i
        arrays.append(n)
        tiles.append(tile)
        return len(tiles) - 1

    # Every body, as (row index, its label), found by the band it falls in.
    frames_of = []                              # row -> [labels, left to right]
    for (name, human, want), (y0, y1) in zip(rows, bands):
        here = [l for l, s in bodies.items() if y0 <= (s[0] + s[1]) // 2 <= y1]
        here.sort(key=lambda l: bodies[l][2])
        if len(here) != want:
            raise SystemExit(
                f'row {human} ({name}): expected {want} frames, found {len(here)}')
        frames_of.append(here)

    # EVERY WISP GOES BACK TO THE FRAME IT CAME OFF, which is the other half of
    # cutting on bodies: the bodies say where the frames are, and this says which
    # frame each loose piece of smoke belongs to. Nothing is discarded -- a wisp
    # that found no owner would simply vanish from the sheet, so the count is
    # printed at the end where it can be seen.
    owner = {}
    for l, s in stats.items():
        if l in bodies:
            continue
        # NEAREST BODY BY THE GAP BETWEEN THE TWO BOXES, IN BOTH AXES, WITH NO
        # ASSUMPTION ABOUT WHICH WAY THE SMOKE LIES. Two narrower rules were
        # tried and both quietly mangled the atlas rather than failing:
        #
        #   horizontal distance only -- a plume is adopted by whichever body
        #     anywhere below it lines up in x, often three rows down, because
        #     the frames sit in a grid. The frame then spans from the wisp to a
        #     body far beneath it: the atlas went 1745px tall to 5116.
        #   "the body must start below the wisp" -- true of a rising plume, false
        #     of the impact puffs, which sit BESIDE the head and start above it.
        #     Their own body is excluded, they are adopted across the sheet, and
        #     one tile came out 1100px wide.
        #
        # A gap of zero in an axis means the boxes overlap in it, so a puff
        # beside its own head scores 0 vertically and a few px horizontally,
        # and nothing further away can beat that.
        best, bestd = None, None
        for row in frames_of:
            for b in row:
                bs = bodies[b]
                dy = max(0, bs[0] - s[1], s[0] - bs[1])
                dx = max(0, s[2] - bs[3], bs[2] - s[3])
                d = (dy + dx, dy)
                if bestd is None or d < bestd:
                    bestd, best = d, b
        owner.setdefault(best, []).append(l)

    for (name, human, want), here in zip(rows, frames_of):
        seq = []
        for b in here:
            group = [b] + owner.get(b, [])
            ys0 = min(stats[l][0] for l in group)
            ys1 = max(stats[l][1] for l in group)
            xs0 = min(stats[l][2] for l in group)
            xs1 = max(stats[l][3] for l in group)
            # THE TILE IS MASKED TO ITS OWN PIXELS, NOT MERELY CROPPED, and on
            # this sheet that is not a nicety. Frame rectangles now OVERLAP --
            # one frame's smoke drifts over the next frame's body, and the rows
            # are close enough that a plume reaches into the row above. A plain
            # crop would carry the neighbour's ink into the tile and it would be
            # drawn in game, attached to the wrong character.
            sub = px[ys0:ys1 + 1, xs0:xs1 + 1].copy()
            keep = np.isin(labels[ys0:ys1 + 1, xs0:xs1 + 1], group)
            sub[~keep] = 0
            seq.append(intern(Image.fromarray(sub, 'RGBA')))
        anims[name] = seq

    # Shelf pack, as square as the ragged frames allow.
    cw = max(t.width for t in tiles) + PAD
    per = int(np.ceil(np.sqrt(len(tiles))))
    shelves, cur = [], []
    for t in tiles:
        cur.append(t)
        if len(cur) == per:
            shelves.append(cur); cur = []
    if cur:
        shelves.append(cur)

    W = cw * per
    H = sum(max(t.height for t in s) + PAD for s in shelves)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    frames, y = [], 0
    for s in shelves:
        sh = max(t.height for t in s) + PAD
        for i, t in enumerate(s):
            x = i * cw
            atlas.paste(t, (x, y))
            ax, ay, bh = anchor(t)
            frames.append({'x': x, 'y': y, 'w': t.width, 'h': t.height,
                           'ax': round(ax, 1), 'ay': round(ay, 1),
                           'bh': round(bh, 1)})
        y += sh

    # THE PACK'S REFERENCE HEIGHT, and the reason the defs carry it: the idle
    # frame is a third smoke, so sizing the pack on the frame would draw a
    # two-thirds-height cigarette under a full-height plume.
    # PER SHEET: the cigarettes size themselves on their idle row, but the horse
    # has no idle -- his rows are all movement. `refAnim` names the row whose
    # first frame stands for the pack, and it must be a NEUTRAL PROFILE: pick a
    # reaching or rearing frame and the whole character shrinks in game to make
    # room for the pose. For the horse that is `walk` frame 0.
    ref = spec.get('refAnim', 'idle')
    if ref not in anims:
        raise SystemExit(
            f"refAnim {ref!r} is not a row on this sheet; have {sorted(anims)}")
    body_h = frames[anims[ref][0]]['bh']

    scale = spec.get('scale', SCALE)
    if scale != 1.0:
        nw, nh = int(round(W * scale)), int(round(H * scale))
        atlas = atlas.resize((nw, nh), Image.LANCZOS)
        for f in frames:
            for k in ('x', 'y', 'w', 'h'):
                f[k] = int(round(f[k] * scale))
            for k in ('ax', 'ay', 'bh'):
                f[k] = round(f[k] * scale, 1)
        body_h = round(body_h * scale, 1)

    base = spec['base']
    atlas.save(OUT + base + '-game.png')
    with open(OUT + base + '-sprites.json', 'w') as fh:
        json.dump({'scale': scale, 'native': spec['native'], 'bodyH': body_h,
                   'frames': frames, 'anims': anims}, fh, indent=1)

    wisps = sum(len(v) for v in owner.values())
    slots = sum(len(v) for v in anims.values())
    print(f'{base}-game.png  {atlas.size[0]}x{atlas.size[1]}  '
          f'{len(tiles)} unique frames for {slots} slots, body {body_h}px')
    print(f'  {len(bodies)} bodies, {wisps} of {len(stats) - len(bodies)} loose '
          f'pieces of smoke re-attached')
    for name, human, _ in rows:
        print(f'  row {human:2d}  {name:10s} {len(anims[name]):2d} slots  '
              f'-> {anims[name]}')


if __name__ == '__main__':
    main()
