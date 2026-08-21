#!/usr/bin/env python3
"""Cut the beat 'em up's HIT EFFECT sheet into a packed atlas + defs.

Third cutter in the family, after build-beat-coconut-defs.py (the player) and
build-beat-enemy-defs.py (the villains), and by far the simplest of the three:
an impact burst has no body, no facing, no ground line and no smoke, so almost
everything those two tools exist for does not apply. What is left is the part
they share -- a RAGGED sheet, cut on content rather than on a cell size.

WHAT THE SHEET IS. effects-porrada-01.png is 8 columns by 3 rows:

    solid  outline  broken  dotted  |  solid  outline  broken  dotted
    <------------ yellow ---------->|<------------- red ----------->

and the animation runs ALONG A ROW, inside one colour block: the star starts
solid, hollows out to an outline, breaks up, and scatters into dots. So the
sheet is SIX four-frame animations -- three different hand-drawn stars, each in
two colours -- not eight three-frame ones. Measured on the pixels: fill ratio
falls 0.46 -> 0.21 -> 0.14 -> 0.08 left to right while the bbox GROWS from 236px
to 342px, which is a burst expanding as it dissipates. Down a column nothing
progresses; the three rows are simply three drawings.

THE RED BLOCK IS THE YELLOW BLOCK RECOLOURED. All twelve pairs have identical
bounding boxes. It is still cut as twelve separate frames rather than tinted at
draw time: tinting a two-tone shape on a canvas costs an offscreen composite per
draw, and the whole atlas is a few tens of KB.

THREE THINGS THAT DIFFER FROM THE CHARACTER CUTTERS:

  * THE ANCHOR IS THE FRAME'S CENTRE, not a ground line. A fighter stands on
    the belt so its anchor is the bottom of the body; a burst is centred on the
    point of impact and expands around it. Bbox centre rather than centroid --
    measured, the two agree to within 3% of the frame on eleven of twelve
    frames, and on the twelfth (row 2's broken outline, which is bottom-heavy)
    the centroid is 13% low, which would visibly drag that one variant down.

  * ONE `baseSize` FOR THE WHOLE PACK, NOT ONE PER ANIMATION, AND THAT IS THE
    POINT. Every frame on the sheet is scaled by the same factor, so the sizes
    the artist drew survive to the screen: the three stars are 236x276, 210x238
    and 201x195, and they arrive on screen in that proportion. The burst also
    GROWS across its four frames -- 236px to 342px -- and that growth is the
    animation, so no frame may be sized individually either.

    ⚠️ IT WAS BUILT THE OTHER WAY FIRST AND THAT WAS WRONG. Each animation had
    its own reference, normalised on sqrt(w*h), so all three variants came out
    the same apparent mass -- on the reasoning that the variant the dice picked
    should not change how big the hit looked. That is a real effect and it is
    not the tool's call to make: the drawing is the drawing. **Do not rescale
    art to even it out. Wire it as it was drawn.** If the size spread turns out
    to be unwanted, that is a conversation about the art, not a normalisation
    quietly applied on the way in.

BANDING, AND THE ONE PIECE OF DIRT ON THE SHEET. Columns come straight off the
column projection: 8 runs, smallest real gap 54px, no fragmentation. Rows cannot
be done the same way on the raw mask, because the dotted frames are made of
disconnected dots and project as up to eleven runs. They are banded per column
instead, after dropping components under MIN_PIECE: within a column band the
worst internal gap is 17px and the smallest real gap is 62px, a 3.6x margin.
The drop matters -- there is a 2px speck at y=1133 in column 2 that otherwise
opens a fourth row band.

Usage:  python3 tools/build-beat-fx-defs.py
"""

import json
import os

import numpy as np
from PIL import Image

SRC = 'assets-v2/beatemup-dungeon/effects-porrada-01.png'
OUT = 'assets-v2/beatemup-dungeon/'
BASE = 'effects-porrada'

ALPHA = 8          # opaque threshold; the art is antialiased into nothing
MIN_PIECE = 24     # px of area below which a component is dirt, not a dot
                   # (measured: dirt tops out at 7px, the smallest real dot is
                   #  126px -- an 18x margin, so the value is not delicate)
BAND_GAP = 40      # px of blank that still counts as inside one frame
COLS = 8
ROWS = 3
PAD = 2            # px between frames in the atlas

# The atlas is drawn at this fraction of the master. The largest frame is 342px
# wide and the biggest a burst is ever drawn in game is about 130px, so half
# size still leaves the GPU more texture than the screen ever asks for.
SCALE = 0.5

# Column block -> colour name. The order is the order they sit on the sheet.
COLOURS = ['yellow', 'red']


def components(mask):
    """Connected components (8-way), as (labels, stats).

    Lifted from build-beat-enemy-defs.py unchanged -- row runs plus a union-find
    rather than a per-pixel flood, which on a sheet this size is the difference
    between a second and several minutes. `stats` maps label -> [y0,y1,x0,x1,area].
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
                if pa <= b + 1 and a <= pb + 1:
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


def bands(flags, gap, want, what):
    """Contiguous True runs, merging any separated by <= gap. Asserts the count.

    Failing loudly here is the whole point: a sheet that bands into the wrong
    number of frames still produces an atlas, and the mistake only shows up as
    an animation that looks subtly wrong weeks later.
    """
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

    if len(merged) != want:
        raise SystemExit(
            f'{what}: found {len(merged)} bands, expected {want}.\n'
            f'  bands: {merged}\n'
            f'  Either the sheet changed shape or BAND_GAP ({gap}px) needs a '
            f'look -- print the raw runs before touching it.')
    return merged


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f'missing {SRC}')
    im = Image.open(SRC).convert('RGBA')
    a = np.array(im)
    opaque = a[:, :, 3] > ALPHA

    # Dirt first. A 2px speck reads as a row band all by itself.
    labels, stats = components(opaque)
    dirt = [l for l, s in stats.items() if s[4] < MIN_PIECE]
    if dirt:
        opaque[np.isin(labels, dirt)] = False

    col_bands = bands(opaque.any(axis=0), BAND_GAP, COLS, 'columns')

    cells = []                                   # (row, col) -> bbox
    for ci, (x0, x1) in enumerate(col_bands):
        strip = opaque[:, x0:x1 + 1]
        row_bands = bands(strip.any(axis=1), BAND_GAP, ROWS,
                          f'rows in column {ci}')
        for ri, (y0, y1) in enumerate(row_bands):
            sub = opaque[y0:y1 + 1, x0:x1 + 1]
            ys, xs = np.nonzero(sub)
            cells.append({
                'row': ri, 'col': ci,
                'x0': int(xs.min()) + x0, 'x1': int(xs.max()) + x0,
                'y0': int(ys.min()) + y0, 'y1': int(ys.max()) + y0,
            })

    # Six animations: one per (colour block, row), read left to right.
    anims = {}
    for ci, colour in enumerate(COLOURS):
        for ri in range(ROWS):
            key = f'{colour}{ri}'
            anims[key] = [c for c in cells
                          if c['row'] == ri and ci * 4 <= c['col'] < ci * 4 + 4]
            anims[key].sort(key=lambda c: c['col'])
            if len(anims[key]) != 4:
                raise SystemExit(f'{key}: {len(anims[key])} frames, expected 4')

    # Shelf-pack: one row of the atlas per animation, which keeps the atlas
    # readable when someone opens it to check a cut.
    shelves = [[c for c in anims[k]] for k in anims]
    W = max(sum(c['x1'] - c['x0'] + 1 + PAD for c in s) for s in shelves) + PAD
    H = sum(max(c['y1'] - c['y0'] + 1 for c in s) + PAD for s in shelves) + PAD
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    frames, out_anims = [], {}
    y = PAD
    for key, cs in anims.items():
        x = PAD
        sh = max(c['y1'] - c['y0'] + 1 for c in cs)
        idx = []
        for c in cs:
            w = c['x1'] - c['x0'] + 1
            h = c['y1'] - c['y0'] + 1
            # Cropped, not masked: unlike the cigarettes nothing on this sheet
            # reaches into a neighbour's rectangle -- the tightest gap between
            # two frames is 49px.
            atlas.paste(im.crop((c['x0'], c['y0'], c['x1'] + 1, c['y1'] + 1)),
                        (x, y))
            idx.append(len(frames))
            frames.append({'x': x, 'y': y, 'w': w, 'h': h,
                           'ax': w / 2.0, 'ay': h / 2.0})
            x += w + PAD
        out_anims[key] = idx
        y += sh + PAD

    # ONE REFERENCE FOR THE WHOLE PACK: the geometric mean of the FIRST frame of
    # the FIRST animation. Everything -- every frame of every variant -- is drawn
    # at `requested / baseSize`, so both the growth across a burst and the size
    # differences between the three stars survive exactly as drawn. See the
    # header for why this is not per-animation.
    first = out_anims[next(iter(out_anims))][0]
    base_h = round((frames[first]['w'] * frames[first]['h']) ** 0.5, 1)

    if SCALE != 1.0:
        atlas = atlas.resize((int(round(W * SCALE)), int(round(H * SCALE))),
                             Image.LANCZOS)
        for f in frames:
            for k in ('x', 'y', 'w', 'h'):
                f[k] = int(round(f[k] * SCALE))
            for k in ('ax', 'ay'):
                f[k] = round(f[k] * SCALE, 1)
        base_h = round(base_h * SCALE, 1)

    atlas.save(OUT + BASE + '-game.png')
    with open(OUT + BASE + '-sprites.json', 'w') as fh:
        json.dump({'scale': SCALE, 'baseSize': base_h,
                   'frames': frames, 'anims': out_anims}, fh, indent=1)

    print(f'{BASE}-game.png  {atlas.size[0]}x{atlas.size[1]}  '
          f'{len(frames)} frames in {len(out_anims)} animations')
    if dirt:
        print(f'  dropped {len(dirt)} specks under {MIN_PIECE}px')
    print(f'  one shared baseSize {base_h}px -- drawn sizes are preserved')
    for k, v in out_anims.items():
        sizes = ' '.join(f"{frames[i]['w']}x{frames[i]['h']}" for i in v)
        rel = (frames[v[0]]['w'] * frames[v[0]]['h']) ** 0.5 / base_h
        print(f'  {k:8s} x{rel:.2f} of the reference  frames {v}  {sizes}')


if __name__ == '__main__':
    main()
