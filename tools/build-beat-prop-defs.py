#!/usr/bin/env python3
"""Cut a beat 'em up PROP sheet into a packed atlas + defs.

    assets-v2/beatemup-dungeon/barril-coconutbash.png
        └── build-beat-prop-defs.py ──►
    assets-v2/beatemup-dungeon/barril-beat-game.png
    assets-v2/beatemup-dungeon/barril-beat-sprites.json

Third cutter in this folder, and the split is the same one build-beat-fx-defs.py
made: the machinery (bands, dedupe, shelf packing, anchors, the JSON shape) is
build-beat-enemy-defs.py's, and what differs is how a FRAME is found.

⚠️ THIS SHEET CANNOT BE CUT ON BODIES, and that is the whole reason for a
separate tool. The villain cutter labels connected components and calls the big
ones characters, because a cigarette is one blob and its smoke is a few small
ones. Half of this sheet is a barrel EXPLODING: frame three of a break is forty
loose splinters, not one of which is a "body", and the largest is a few hundred
px. Run that sheet through the body rule and you do not get a mangled atlas, you
get 200 frames where the table says 30 -- so it is cut on INK BANDS instead,
which is what the fx sheet does and what this art actually is.

⚠️ THE SHEET HAS GHOSTS ON IT, and they are invisible. At the right-hand edge of
the first two rows sit four bomb outlines drawn in near-transparent white --
about 280 opaque pixels each against a real frame's 30000. They do not show in a
viewer against white and they are almost certainly a leftover sketch layer, but
a column scan finds them and would hand you two rows with six frames where the
art has four. `MIN_INK` drops them. It is not a fine judgement: the gap between
the largest ghost (280) and the smallest real frame (10711, the drumstick) is a
factor of 38.

⚠️ AND THE SHEET IS FULL OF DELIBERATE REPEATS. The four upright barrels in row
1 are TWO drawings alternating (A B A B) -- a boil, not four variants -- and
rows 4 and 5 are those same two drawings rotated onto their side, eight slots
for two tiles. Rows 2 and 3 are the same three break drawings twice. Every one
of those folds in `intern()`, which dedupes on mean absolute difference, so the
atlas carries 13 tiles for 30 slots and the anims still read exactly as the
illustrator laid them out. Do not "fix" the repeats by deleting rows from the
table: the repeat IS the animation, and the table is what proves the sheet has
not changed under us.

THE ANCHOR IS THE BASE, NOT THE MIDDLE OF THE BOX, and it is worth knowing why
on a sheet with no feet in it. A break is drawn expanding: 235px of barrel
becomes a 572px cloud, and it does not expand symmetrically. Anchored on the
bbox centre the pile slides sideways as it grows -- the break visibly walks a
third of a barrel to the left as it plays. So `ax` is the centroid of the ink in
the bottom BASE_FRAC of the frame: the part sitting on the floor, which is the
part that does not move. On an intact barrel the two rules agree to within a
third of a pixel; on the third break frame they differ by 25.

Usage:  python3 tools/build-beat-prop-defs.py barril
        python3 tools/build-beat-prop-defs.py barril --dry-run
"""
import json
import sys

import numpy as np
from PIL import Image

OUT = 'assets-v2/beatemup-dungeon/'

# Atlas downscale. The barrel is drawn 318px tall and stands about 110px in
# game, so this leaves ~140px of barrel in the texture -- always downscaled at
# draw time, never stretched. Same bargain as the character sheets; see
# PERFORMANCE.md for what happens when textures get away.
SCALE = 0.44
PAD = 2            # transparent gutter between packed frames
ALPHA = 8          # alpha above this counts as content
# Smallest thing that counts as a frame. See the header: the ghost outlines are
# ~280px and the smallest real frame is 10711.
MIN_INK = 2000
BAND_GAP = 40      # empty rows tolerated inside one row band
COL_GAP = 60       # empty columns tolerated inside one frame
SAME = 2.5         # mean abs channel difference below which two frames are one
SIZE_TOL = 2       # px of width/height difference tolerated when matching
# Fraction of the frame, measured up from its bottom, that counts as its BASE
# for the horizontal anchor. See the header.
BASE_FRAC = 0.25

SHEETS = {
    # THE BARREL SHEET. Nine bands, and the names below are what the game asks
    # for -- see CONFIG.CHARACTERS.barril.poses, which slices them into poses.
    #
    # `native` is 'right' like every other sheet drawn for this game. A barrel
    # is very nearly symmetrical so it barely shows, but the field is not
    # optional: sheets.js mirrors against it, and a wrong value flips every
    # frame of the break.
    'barril': {
        'src': 'assets-v2/beatemup-dungeon/barril-coconutbash.png',
        'base': 'barril-beat',
        'native': 'right',
        # The pack's reference height is the upright barrel, which is what
        # everything else is scaled against in game.
        'refAnim': 'idle',
        'bands': [
            ('idle',      1, 4),   # upright. TWO drawings, A B A B -- a boil
            ('brk',       2, 3),   # it bursts: crack, burst, cloud of splinters
            ('brk2',      3, 3),   # ⚠️ the same three drawings again; dedupe folds them
            ('side',      4, 4),   # on its side. The idle pair, rotated
            ('side2',     5, 4),   # ⚠️ and again
            ('brkSide',   6, 3),   # the break, rotated: the scatter goes wide
            ('bomb',      7, 3),   # ⚠️ CUT BUT NOT WIRED -- no bomb mechanic yet
            ('bomb2',     8, 3),   # ⚠️ likewise
            ('food',      9, 2),   # slot 0 the roast chicken, slot 1 the drumstick
        ],
    },
}


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
    """Ground point and height inside a tile: (ax, ay, bh).

    `ay` is the bottom of the ink and `bh` how tall it is above that. `ax` is
    the centroid of the bottom BASE_FRAC of the ink -- see the header for why a
    bbox centre walks the break sideways as it expands.
    """
    a = np.array(tile)
    opaque = a[:, :, 3] > ALPHA
    ys = np.nonzero(opaque.any(axis=1))[0]
    top, bottom = int(ys.min()), int(ys.max()) + 1

    base = opaque.copy()
    base_top = max(top, bottom - max(1, int(round((bottom - top) * BASE_FRAC))))
    base[:base_top] = False
    base[bottom:] = False
    if not base.any():
        base = opaque
    _, xs = np.nonzero(base)
    return float(xs.mean()), float(bottom), float(bottom - top)


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else 'barril'
    dry = '--dry-run' in sys.argv
    spec = SHEETS.get(which)
    if not spec:
        raise SystemExit(f'unknown sheet {which!r}; have {sorted(SHEETS)}')
    table = spec['bands']

    im = Image.open(spec['src']).convert('RGBA')
    px = np.array(im)
    ink = px[:, :, 3] > ALPHA

    bands = runs(ink.any(axis=1), BAND_GAP)
    if len(bands) != len(table):
        raise SystemExit(
            f'expected {len(table)} row bands, found {len(bands)}: '
            + ', '.join(f'{y0}-{y1}' for y0, y1 in bands))

    tiles, arrays, anims = [], [], {}

    def intern(tile):
        """Index of an equal-looking tile already packed, else pack this one.

        This is what makes the repeats free, and this sheet repeats more than
        any other in the project: 30 slots come out as 13 tiles.
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

    report = []
    for (name, human, want), (y0, y1) in zip(table, bands):
        strip = ink[y0:y1 + 1]
        cols = runs(strip.any(axis=0), COL_GAP)
        boxes = []
        for x0, x1 in cols:
            cell = strip[:, x0:x1 + 1]
            if int(cell.sum()) < MIN_INK:      # a ghost -- see the header
                continue
            ys = np.nonzero(cell.any(axis=1))[0]
            boxes.append((x0, x1, y0 + int(ys.min()), y0 + int(ys.max())))
        if len(boxes) != want:
            raise SystemExit(
                f'row {human} ({name}): expected {want} frames, found {len(boxes)} '
                f'in band y {y0}-{y1}')
        seq = []
        for x0, x1, t, b in boxes:
            seq.append(intern(Image.fromarray(px[t:b + 1, x0:x1 + 1].copy(), 'RGBA')))
        anims[name] = seq
        report.append((human, name, seq))

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
        for i, t in enumerate(s):
            x = i * cw
            atlas.paste(t, (x, y))
            ax, ay, bh = anchor(t)
            frames.append({'x': x, 'y': y, 'w': t.width, 'h': t.height,
                           'ax': round(ax, 1), 'ay': round(ay, 1),
                           'bh': round(bh, 1)})
        y += max(t.height for t in s) + PAD

    ref = spec.get('refAnim', 'idle')
    if ref not in anims:
        raise SystemExit(f"refAnim {ref!r} is not a band; have {sorted(anims)}")
    body_h = frames[anims[ref][0]]['bh']

    scale = spec.get('scale', SCALE)
    if scale != 1.0:
        atlas = atlas.resize((int(round(W * scale)), int(round(H * scale))),
                             Image.LANCZOS)
        for f in frames:
            for k in ('x', 'y', 'w', 'h'):
                f[k] = int(round(f[k] * scale))
            for k in ('ax', 'ay', 'bh'):
                f[k] = round(f[k] * scale, 1)
        body_h = round(body_h * scale, 1)

    base = spec['base']
    if not dry:
        atlas.save(OUT + base + '-game.png')
        with open(OUT + base + '-sprites.json', 'w') as fh:
            json.dump({'scale': scale, 'native': spec['native'], 'bodyH': body_h,
                       'frames': frames, 'anims': anims}, fh, indent=1)

    slots = sum(len(v) for v in anims.values())
    print(f'{base}-game.png  {atlas.size[0]}x{atlas.size[1]}  '
          f'{len(tiles)} unique tiles for {slots} slots, ref {body_h}px'
          + ('   [dry run, nothing written]' if dry else ''))
    for human, name, seq in report:
        print(f'  row {human}  {name:9s} {len(seq)} slots -> {seq}')


if __name__ == '__main__':
    main()
