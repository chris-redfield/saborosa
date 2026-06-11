#!/usr/bin/env python3
"""Extract block/prop bounding boxes from assets/saborosa-assets-002.png.

This sheet REPLACES the old 6-cube sheet (cor-saborosa-box-01.png). Its objects
fall into two behaviors, split by position on the sheet:

  * "block" (14) - rows 1-3 plus the two brown shapes in row 4. These spawn
    randomly around the map as pickable/throwable blocks (the Rock entity), at a
    FIXED size (no random scaling - see BLOCK_SCALE in src/entities/environment.js).
  * "prop" (3) - the wooden frame/platform (row 4, col 1) and the whole last row
    (big crate-stack, lattice tower). These behave like the map-editor trees:
    placed by hand, block movement, depth-sort, NOT pickable (MapObject entity).

Detection mirrors build-asset-defs.py (alpha mask -> dilation-merge connected
components -> row grouping -> normalized `col` box, preserving hand-tuned `col`
by id on re-run). The one wrinkle: this scan has a few sparse vertical slivers
(faint stray marks to the right of the tower) that pass the area gate, so we add
a min-dimension + fill filter. All 17 real assets have min(w,h) >= 562 and
fill >= 0.49; the slivers are <= 350px wide or < 0.20 filled, so the gate below
removes exactly those 3 and keeps every real object.

Run from the project root:  python3 tools/build-block-defs.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

A = 'assets/'
SHEET = 'saborosa-assets-002.png'
OUT = A + 'saborosa-assets-002-sprites.json'

# Default red-collision box (normalized): a full-width, bottom-half footprint,
# matching the OLD cube collision (collision-config.json `rock`: w1.0/h0.5/offY0.5)
# these blocks replace. This also sets each block's weight (mass = colW*colH, which
# gates lift/push), so big crate clusters come out heavier than single boxes -
# the same liftable-small / too-heavy-big mix the cubes had. Tune per-asset in the
# map editor's Collision tab (esp. the irregular L/stair clusters and the props).
DEFAULT_COL = {'offX': 0.00, 'offY': 0.50, 'w': 1.00, 'h': 0.50}

ALPHA_THRESH = 30      # opaque if alpha > this
DILATE = 25            # px; merges drawn parts of one object into one component
MIN_AREA = 800         # drop tiny specks
MIN_DIM = 450          # drop slivers: every real asset is >= 562px on its short side
MIN_FILL = 0.25        # drop sparse strays: real assets fill >= 0.49 of their bbox
ROW_GAP = 450          # px between row centers to start a new row


def detect_boxes(alpha):
    """Return rows -> [[x0,y0,x1,y1], ...], grouped top->bottom, left->right."""
    mask = alpha > ALPHA_THRESH
    dil = ndimage.binary_dilation(mask, np.ones((DILATE, DILATE), bool))
    lbl, n = ndimage.label(dil)
    slices = ndimage.find_objects(lbl)
    boxes = []
    for i, sl in enumerate(slices):
        ys, xs = sl
        comp = (lbl[sl] == i + 1) & mask[sl]   # tighten to real (undilated) px
        area = int(comp.sum())
        if area < MIN_AREA:
            continue
        yy, xx = np.where(comp)
        x0, y0 = int(xs.start + xx.min()), int(ys.start + yy.min())
        x1, y1 = int(xs.start + xx.max() + 1), int(ys.start + yy.max() + 1)
        w, h = x1 - x0, y1 - y0
        if min(w, h) < MIN_DIM or area / (w * h) < MIN_FILL:
            continue                            # sliver / faint stray mark
        boxes.append([x0, y0, x1, y1])

    # Group into rows by vertical center, then sort each row left-to-right.
    boxes.sort(key=lambda b: b[1])
    rows, cur, last_cy = [], [], None
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if last_cy is None or cy - last_cy < ROW_GAP:
            cur.append(b)
        else:
            rows.append(cur)
            cur = [b]
        last_cy = cy
    if cur:
        rows.append(cur)
    for row in rows:
        row.sort(key=lambda b: b[0])
    return rows


def kind_for(row_idx, col_idx, n_rows):
    """Prop iff it's in the last row, or the FIRST cell of the penultimate row
    (the wooden platform). Everything else is an interactive block."""
    if row_idx == n_rows - 1:
        return 'prop'
    if row_idx == n_rows - 2 and col_idx == 0:
        return 'prop'
    return 'block'


def main():
    path = A + SHEET
    if not os.path.exists(path):
        print('ERROR missing', path)
        return 1
    alpha = np.asarray(Image.open(path).convert('RGBA'))[:, :, 3]
    rows = detect_boxes(alpha)

    # Preserve any previously-tuned collision boxes by id.
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT)).get('assets', {})
        except Exception:
            prev = {}

    assets = {}
    n_block = n_prop = 0
    n_rows = len(rows)
    for r, row in enumerate(rows):
        for c, (x0, y0, x1, y1) in enumerate(row):
            kind = kind_for(r, c, n_rows)
            if kind == 'prop':
                aid = f'prop_{n_prop:02d}'
                n_prop += 1
            else:
                aid = f'block_{n_block:02d}'
                n_block += 1
            col = prev.get(aid, {}).get('col', dict(DEFAULT_COL))
            assets[aid] = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0,
                           'kind': kind, 'col': col}

    out = {'sheet': SHEET, 'assets': assets}
    json.dump(out, open(OUT, 'w'), indent=2)
    print(f'wrote {OUT}: {len(assets)} assets ({n_block} block, {n_prop} prop) '
          f'across {n_rows} rows')
    for r, row in enumerate(rows):
        kinds = [kind_for(r, c, n_rows)[0] for c in range(len(row))]
        print(f'  row {r}: {len(row)} -> {"".join(kinds)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
