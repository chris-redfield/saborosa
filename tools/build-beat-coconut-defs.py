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
import numpy as np
from PIL import Image

SRC   = 'assets-v2/beatemup-dungeon/coconut-sprites-flat.png'
OUT   = 'assets-v2/beatemup-dungeon/'
BASE  = 'coconut-beat'

# Shipped smaller than the master: the fighter draws at ~152px tall and the art
# is authored near 200px, so 0.8 keeps it above the drawn size (crisp) while
# cutting the decoded texture to about two thirds. See PERFORMANCE.md for what
# happens when sheet textures get away from us.
SCALE = 0.8
PAD   = 2          # transparent gutter between packed frames
ALPHA = 8          # alpha above this counts as content
# Both gaps are deliberately TIGHT. Two rows of this sheet sit only 6px apart,
# and two combo frames are separated by a SINGLE empty column -- a generous
# threshold silently welds them into one frame and the counts stop matching.
BAND_GAP = 2       # empty rows tolerated inside one row band
GAP      = 0       # empty columns tolerated inside one frame
SAME     = 2.5     # mean abs channel difference below which two frames are one
SIZE_TOL = 2       # px of width/height difference tolerated when matching

# Which way the art is DRAWN. This sheet faces right; the main game's character
# packs face left. It is recorded in the defs rather than assumed in the game,
# because getting it wrong does not fail loudly -- the character simply walks
# backwards, facing away from the way it is going.
NATIVE = 'right'

# The coconut body, for the anchor. Quantised palette from the master:
# body (192,168,144) tan, arms (240,216,48) yellow, skirt white, neck red.
BODY_RGB   = (192, 168, 144)
BODY_TOL   = 40
# How many body-coloured pixels a row needs before it counts as the body.
# NOT a tuning constant -- it is the difference between a stoop and a handstand.
# See anchor().
BODY_MIN_RUN = 6

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


def main():
    im = Image.open(SRC).convert('RGBA')
    a = np.array(im)[:, :, 3] > ALPHA

    bands = runs(a.any(axis=1), BAND_GAP)
    if len(bands) != len(ROWS):
        raise SystemExit(f'expected {len(ROWS)} rows, found {len(bands)}')

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

    for (name, human, want), (y0, y1) in zip(ROWS, bands):
        cols = runs(a[y0:y1 + 1].any(axis=0), GAP)
        if len(cols) != want:
            raise SystemExit(
                f'row {human} ({name}): expected {want} frames, found {len(cols)}')
        seq = []
        for (x0, x1) in cols:
            tile = im.crop((x0, y0, x1 + 1, y1 + 1))
            # Tighten vertically too: the band is as tall as its tallest pose.
            t = np.array(tile)[:, :, 3] > ALPHA
            ys = np.nonzero(t.any(axis=1))[0]
            tile = tile.crop((0, int(ys[0]), tile.width, int(ys[-1]) + 1))
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
    for name, human, _ in ROWS:
        print(f'  row {human:2d}  {name:11s} {len(anims[name]):2d} slots  '
              f'-> {sorted(set(anims[name]))}')


if __name__ == '__main__':
    main()
