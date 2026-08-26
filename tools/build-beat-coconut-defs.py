#!/usr/bin/env python3
"""Cut the beat 'em up's dedicated coconut sheet into a packed atlas + defs.

THIS SHEET IS NOT A GRID. Unlike the main game's 9x5 character packs, the art
arrives as 13 ragged rows with different frame counts (3..10) and frame widths
that swing from 190px to 285px, because an extended arm is simply wider than a
guard. So there is no cell size to divide by: every frame is found by its own
content bbox, and the defs carry per-frame rects.

THE ANCHOR IS THE POINT OF THIS TOOL. Centring a ragged frame on its bbox is
wrong: when the arm shoots out to the right the bbox centre moves right, so the
BODY slides left, and the character wobbles on every punch. Instead each frame
stores an anchor read off the coconut BODY only (the tan ball, ignoring the
yellow arms) -- horizontal centroid, and the body's lowest row as the ground
line. Draw the frame with that anchor over the fighter's ground point and the
body stays planted however far a limb reaches.

Anchoring on the body bottom also strips any lift the artist drew into the jump
frames, which is correct here: `jumpY` is applied in code and is draw-only, so
a lift baked into the art would be added twice.

FRAMES REPEAT A LOT. Both combo rows share their first eight drawings, and
within a row the guard and the straight punch each appear three times -- 74
slots resolve to far fewer unique images. Repeats are packed once and
referenced by index, which is most of the reason the atlas is small.

THE REPEATS ARE NOT BYTE-IDENTICAL. They are the same drawing placed a hair
differently, so an exact-bytes compare finds nothing and silently packs all 74.
Frames therefore match on MEAN ABSOLUTE DIFFERENCE at equal size. The threshold
is safe by a wide margin, not by a fine judgement: measured across a combo row,
repeats score 0.0-1.6 and genuinely different poses score above 30.

The same drawing also lands a PIXEL TALLER in places, so the compare tolerates a
small size difference and scales the candidate to match. Requiring equal size
instead splits a drawing into two atlas entries over one row of pixels, which is
how the first cut packed 54 frames where 45 would do.

Row meanings are the illustrator's, 1-indexed as given (see ROWS below).

Output names follow the main game's character-pack convention (`-game.png` /
`-sprites.json`) so beatemup-dungeon/src/manifest.js loads them with the same
two lines it uses for every other pack, and package.sh needs no edit.

Outputs (assets-v2/beatemup-dungeon/):
  coconut-beat-game.png     packed atlas, downscaled by SCALE
  coconut-beat-sprites.json { scale, native, frames:[{x,y,w,h,ax,ay}],
                              anims:{name:[..]} }
"""
import json
from collections import deque
import numpy as np
from PIL import Image

OUT   = 'assets-v2/beatemup-dungeon/'
PAD   = 2          # transparent gutter between packed frames
ALPHA = 8          # alpha above this counts as content
# Both gaps are deliberately TIGHT. Two rows of this sheet sit only 6px apart,
# and two combo frames are separated by a SINGLE empty column -- a generous
# threshold silently welds them into one frame and the counts stop matching.
BAND_GAP = 2       # empty rows tolerated inside one row band
GAP      = 0       # empty columns tolerated inside one frame
SAME     = 2.5     # mean abs channel difference below which two frames are one
SIZE_TOL = 2       # px of width/height difference tolerated when matching
# A border-touching blob smaller than this fraction of the frame's main blob is
# the neighbour's, not this frame's. See strip_seam(). The gap it sits in is
# wide: the sliver measures 0.003 of the body and the smallest real part of a
# drawing measures far more, so this is not a fine judgement.
SEAM_FRAC = 0.05

# Which way the art is DRAWN. Both sheets face right; the main game's character
# packs face left. It is recorded in the defs rather than assumed in the game,
# because getting it wrong does not fail loudly -- the character simply walks
# backwards, facing away from the way it is going.
NATIVE = 'right'

# How many body-coloured pixels a row needs before it counts as the body.
# NOT a tuning constant -- it is the difference between a stoop and a handstand.
# See anchor().
BODY_MIN_RUN = 6
BODY_TOL     = 40

# (name, human row number, expected frame count). The illustrator's list.
ROWS = [
    ('idle',       1,  3),   # respirando
    ('walk',       2,  6),   # andando
    ('jump',       3,  6),   # pulando
    ('airPunch',   4,  7),   # pulando e socando -- a voadora, with fists
    ('combo',      5, 10),   # combo 1, five hits, ends in the UPPERCUT
    ('comboLow',   6, 10),   # combo 2, five hits, ends in the LOW PUNCH
    ('lift',       7,  4),   # levanta um objeto na frente
    ('liftThrow',  8,  5),   # levanta e joga
    ('pickGround', 9,  2),   # pega objeto do chao
    ('carryWalk', 10,  5),   # carregando e andando
    ('hurt',      11,  2),   # apanhando 1
    ('knockdown', 12,  6),   # apanhando e caindo no chao
    ('death',     13,  8),   # caindo no chao e morrendo
]

# The strong coconut is the SAME thirteen rows in the SAME order -- and one row
# is not the same length. Row 8 has SIX drawings where the first sheet had five:
# the artist added a second arms-overhead tween between the reach and the swing.
# Confirmed against both sheets before it was written down, because "the exact
# same sprites" was the brief and a miscounted row is the one error this cutter
# cannot see -- it would simply pack the sheet a frame out of step from row 8
# onward and every pose after it would be someone else's drawing.
ROWS_STRONG = [(n, h, 6 if n == 'liftThrow' else c) for (n, h, c) in ROWS]

VARIANTS = {
    # ⚠️ SCALE IS NOT A TASTE SETTING, IT IS A MEASUREMENT. The strong master is
    # drawn 1.967x the size of the first one (median body height 299px against
    # 152px, over the idle/walk/jump frames), so 0.8 / 1.967 is what puts the
    # new character on screen at exactly the height of the old one. It has to
    # be, because he inherits the old one's hitboxes, reach and walk speed --
    # every one of those numbers was tuned against a 152px body, and shipping
    # him 2x bigger would silently retune all of them at once.
    'coconut': dict(
        src='assets-v2/beatemup-dungeon/coconut-sprites-flat.png',
        base='coconut-beat', scale=0.8, rows=ROWS,
        # Quantised palette from the master: body tan, arms (240,216,48)
        # yellow, skirt white, neck red.
        body=(192, 168, 144)),
    'strong': dict(
        src='assets-v2/beatemup-dungeon/coconut-strong-sprites-fim.png',
        base='coconut-strong-beat', scale=0.8 / 1.9671, rows=ROWS_STRONG,
        # ⚠️ AND THE BODY IS A DIFFERENT COLOUR, which is why this is a variant
        # field and not a constant. The strong coconut is a darker, greener
        # (156,156,111) against the first one's tan. The anchor is read off body
        # pixels only, so pointing it at the old tan finds the wrong mask and
        # the character wobbles on every punch -- the exact failure the header
        # describes. Measured off the master, not guessed from the picture.
        body=(156, 156, 111)),
}

SRC = OUT_BASE = BASE = None
SCALE = 1.0
BODY_RGB = (0, 0, 0)


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


def split_welds(cols, want, ink):
    """Cut apart frames that TOUCH, until a row has the count it should.

    THE SECOND SHEET IS DRAWN TIGHTER THAN THE FIRST AND SOME FRAMES OVERLAP.
    On the strong master the idle coconut's fists run into the next drawing's
    fists, so three poses come back as two runs of ink, and the jump and
    air-punch rows do the same. There is no empty column to find between them:
    widening GAP cannot help, because the gap is not small, it is ABSENT.

    So the split is made on WIDTH. A row's frames are all about one width, a
    welded pair is about two, and the seam is where the fists graze -- the
    thinnest column of ink inside the run. Repeatedly halving the widest run at
    its own minimum, until the count matches, needs no per-row threshold: the
    expected count in ROWS is the stopping condition, and it is the
    illustrator's own number.

    ⚠️ THE SEAM IS SEARCHED IN THE MIDDLE 60% OF THE RUN, not across all of it.
    The thinnest column of a single drawing is usually at its very edge, where
    the outline tapers to nothing, so an unrestricted minimum splits one frame
    into a frame and a sliver rather than splitting a welded pair.
    """
    cols = [list(c) for c in cols]
    while len(cols) < want:
        i = max(range(len(cols)), key=lambda k: cols[k][1] - cols[k][0])
        x0, x1 = cols[i]
        w = x1 - x0 + 1
        lo, hi = x0 + int(w * 0.2), x0 + int(w * 0.8)
        if hi - lo < 2:
            raise SystemExit('cannot split a run of %d px into more frames' % w)
        cut = lo + int(np.argmin(ink[lo:hi + 1]))
        cols[i:i + 1] = [[x0, cut - 1], [cut, x1]]
    return [tuple(c) for c in cols]


def strip_seam(tile):
    """Erase the neighbour's fingertips left behind by a weld cut.

    A SPLIT IS A STRAIGHT VERTICAL LINE THROUGH TWO OVERLAPPING DRAWINGS, so
    whichever fist crossed the seam arrives in the wrong frame as a small blob
    stuck to the border. On the strong master exactly one frame has it -- the
    third idle drawing carries 51px of the second one's knuckle down its left
    edge -- and one visible speck beside a character is worth removing.

    THE RULE IS "SMALL AND TOUCHING A SIDE BORDER", both halves needed:
      - touching, because a stray in the MIDDLE of a frame is the artist's
        (a fleck of outline, a dot of shading) and must survive;
      - small, because the body itself touches both borders in every frame --
        the frames are cropped tight, so an untested "touching" rule would
        erase the character.

    ⚠️ IT IS RUN OVER THE FIRST SHEET TOO AND CHANGES NOTHING THERE, which is
    the check that the rule is narrow enough: that pack's five strays are all
    interior (1-4px, at x43..x127 of frames 150-181 wide), so it rebuilds
    byte-identical. A rule that quietly repacked the shipped coconut would be
    the wrong rule no matter how good this sheet looked.
    """
    a = np.array(tile)
    t = a[:, :, 3] > ALPHA
    h, w = t.shape
    if not t.any():
        return tile

    # Label every blob once. Tiles are small and this runs only on split rows.
    seen = np.zeros_like(t)
    blobs = []
    for y0 in range(h):
        for x0 in range(w):
            if not t[y0, x0] or seen[y0, x0]:
                continue
            q = deque([(y0, x0)])
            seen[y0, x0] = True
            cells = []
            edge = False
            while q:
                cy, cx = q.popleft()
                cells.append((cy, cx))
                if cx == 0 or cx == w - 1:
                    edge = True
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and t[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
            blobs.append((cells, edge))

    biggest = max(len(c) for c, _ in blobs)
    killed = 0
    for cells, edge in blobs:
        if not edge or len(cells) >= biggest * SEAM_FRAC:
            continue
        for cy, cx in cells:
            a[cy, cx] = 0
        killed += len(cells)
    if not killed:
        return tile
    return Image.fromarray(a)


def anchor(tile):
    """Ground point inside a tile: body centroid x, body bottom y.

    THE BOTTOM IS THE LOWEST ROW WITH A REAL RUN OF BODY IN IT, not the lowest
    body-coloured pixel, and that distinction is the whole function.

    Where the yellow arm meets its black outline the art antialiases through
    colours that sit within tolerance of the body tan. They are single pixels --
    literally one per row -- but "lowest matching pixel" cannot tell them from
    a body, so on the ground-pickup frame the bottom came out 34px below the
    real body, at the tip of the reaching arm. Planted on the floor line, that
    drew the coconut hanging in the air off its own hand: a handstand.

    Requiring BODY_MIN_RUN pixels in a row ignores the strays and needs no
    tuning -- the real body has 8 to 51 pixels per row where the noise has 1.
    Rows below the bottom are then dropped from the centroid too, so a stray
    cannot pull the horizontal anchor sideways either.

    Falls back to the whole silhouette if no body pixels are found, so a frame
    drawn in an unexpected palette still lands somewhere sane instead of at 0,0.
    """
    a = np.array(tile)
    opaque = a[:, :, 3] > ALPHA
    d = np.abs(a[:, :, :3].astype(int) - np.array(BODY_RGB)).sum(axis=2)
    body = opaque & (d < BODY_TOL * 3)
    if body.sum() < 40:
        body = opaque

    per_row = body.sum(axis=1)
    solid = np.nonzero(per_row >= BODY_MIN_RUN)[0]
    if not len(solid):                      # a very small body: take what there is
        solid = np.nonzero(per_row > 0)[0]
    bottom = int(solid.max()) + 1

    body[bottom:] = False
    ys, xs = np.nonzero(body)
    return float(xs.mean()), float(bottom)


def main(which='coconut'):
    global SRC, BASE, SCALE, BODY_RGB
    if which not in VARIANTS:
        raise SystemExit('unknown variant %r; have %s'
                         % (which, ', '.join(VARIANTS)))
    v = VARIANTS[which]
    SRC, BASE, SCALE, BODY_RGB = v['src'], v['base'], v['scale'], v['body']
    rows = v['rows']

    im = Image.open(SRC).convert('RGBA')
    a = np.array(im)[:, :, 3] > ALPHA

    bands = runs(a.any(axis=1), BAND_GAP)
    if len(bands) != len(rows):
        raise SystemExit(f'expected {len(rows)} rows, found {len(bands)}')

    tiles, anims = [], {}
    arrays = []                                 # np view of each packed tile

    def intern(tile):
        """Index of an equal-looking tile already packed, else pack this one."""
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

    for (name, human, want), (y0, y1) in zip(rows, bands):
        band = a[y0:y1 + 1]
        cols = runs(band.any(axis=0), GAP)
        if len(cols) > want:
            raise SystemExit(
                f'row {human} ({name}): expected {want} frames, found {len(cols)}'
                ' -- too MANY, which is a miscounted row, not a weld')
        welded = len(cols) < want
        if welded:
            cols = split_welds(cols, want, band.sum(axis=0))
            print(f'  row {human} ({name}): split {want - len(runs(band.any(axis=0), GAP))}'
                  f' welded frame(s) apart')
        seq = []
        for (x0, x1) in cols:
            tile = im.crop((x0, y0, x1 + 1, y1 + 1))
            # ⚠️ ONLY ON A ROW THAT WAS SPLIT. A seam is the only thing that can
            # put a neighbour's ink in this frame, so a row cut on its own empty
            # columns is left exactly as the artist drew it.
            if welded:
                tile = strip_seam(tile)
            # Tighten to content: the band is as tall as its tallest pose, and a
            # stripped seam leaves dead columns at the edge it was stripped from.
            t = np.array(tile)[:, :, 3] > ALPHA
            ys = np.nonzero(t.any(axis=1))[0]
            xs = np.nonzero(t.any(axis=0))[0]
            tile = tile.crop((int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1))
            seq.append(intern(tile))
        anims[name] = seq

    # Pack into as square a grid as the frames allow. Rows are variable height,
    # so this is a shelf pack: simple, and with 60-odd tiles the waste is small.
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
            ax, ay = anchor(t)
            frames.append({'x': x, 'y': y, 'w': t.width, 'h': t.height,
                           'ax': round(ax, 1), 'ay': round(ay, 1)})
        y += sh

    if SCALE != 1.0:
        nw, nh = int(round(W * SCALE)), int(round(H * SCALE))
        atlas = atlas.resize((nw, nh), Image.LANCZOS)
        for f in frames:
            for k in ('x', 'y', 'w', 'h'):
                f[k] = int(round(f[k] * SCALE))
            for k in ('ax', 'ay'):
                f[k] = round(f[k] * SCALE, 1)

    atlas.save(OUT + BASE + '-game.png')
    with open(OUT + BASE + '-sprites.json', 'w') as fh:
        json.dump({'scale': SCALE, 'native': NATIVE,
                   'frames': frames, 'anims': anims}, fh, indent=1)

    slots = sum(len(v) for v in anims.values())
    print(f'{BASE}-game.png  {atlas.size[0]}x{atlas.size[1]}  '
          f'{len(tiles)} unique frames for {slots} slots')
    for name, human, _ in rows:
        print(f'  row {human:2d}  {name:11s} {len(anims[name]):2d} slots  '
              f'-> {sorted(set(anims[name]))}')


if __name__ == '__main__':
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else 'coconut')
