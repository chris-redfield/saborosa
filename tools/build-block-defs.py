#!/usr/bin/env python3
"""Extract block bounding boxes from the objects sheet into block_defs.

Source master: assets-v2/saborosa-objetos-novos.png (transparent, 2879x1420).
This REPLACED the old assets-002 sheet (which itself replaced the 6-cube sheet).
Every object on it is an interactive **block** (pickable/throwable Rock, spawned
randomly around the gray areas at a FIXED size — see BLOCK_SCALE in
src/entities/environment.js). There are no `prop`-kind objects on this sheet.

Unlike the old master (huge 4960x7016, shipped 0.25x-downscaled), this art is
small and drawn at ~60-230px cells. Downscaling would only blur it, so — like
the character packs (build-character-defs.py) — we CROP the master to its content
bbox and ship it 1:1 as the game sheet (block_sheet sheetScale = 1.0). Defs are
written in that cropped-sheet's coordinates so the sheet the game/editor load is
the same one the crop rects index into (no remap needed).

Detection mirrors build-asset-defs.py: alpha mask -> dilation-merge connected
components -> row grouping -> normalized `col` box, preserving hand-tuned `col`
by id on re-run.

Outputs (assets/):
  saborosa-assets-002-game.png      cropped, 1:1 game sheet (block_sheet)
  saborosa-assets-002-sprites.json  crop rects (cropped-sheet coords) + col + kind

Run from the project root:  python3 tools/build-block-defs.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

MASTER = 'assets-v2/saborosa-objetos-novos.png'
OUT_PNG = 'assets/saborosa-assets-002-game.png'
OUT_JSON = 'assets/saborosa-assets-002-sprites.json'

# Default red-collision box (normalized): a full-width, bottom-half footprint,
# matching the OLD cube collision these blocks replace. mass = colW*colH gates
# lift/push, so big clusters come out heavier (too heavy to lift) than single
# boxes — the same liftable-small / too-heavy-big mix. Tune per-asset in the map
# editor's Collision tab (esp. the irregular L/stair clusters).
DEFAULT_COL = {'offX': 0.00, 'offY': 0.50, 'w': 1.00, 'h': 0.50}

# Params tuned for THIS sheet (small canvas, ~60-230px objects). The old sheet's
# values (DILATE 25 / MIN_DIM 450 / ROW_GAP 450) were sized for the 4960x7016
# master and filter everything here to nothing.
ALPHA_THRESH = 30      # opaque if alpha > this
DILATE = 18            # px; merges drawn parts of one object into one component
MIN_AREA = 800         # drop tiny specks (smallest real object ~3900px area)
MIN_DIM = 40           # drop slivers (smallest real object ~63px short side)
MIN_FILL = 0.20        # drop sparse strays (real objects fill >= 0.6 of bbox)
ROW_GAP = 90           # px between row centers to start a new row
PAD = 8                # transparent margin kept around the content crop


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


def main():
    if not os.path.exists(MASTER):
        print('ERROR missing', MASTER)
        return 1
    im = Image.open(MASTER).convert('RGBA')
    alpha = np.asarray(im)[:, :, 3]
    rows = detect_boxes(alpha)
    # Row-major (top->bottom, L->R), remembering each box's source row so we can
    # size-tune per row below.
    boxes = [(b, r) for r, row in enumerate(rows) for b in row]
    n_rows = len(rows)

    # Content crop over every detected box, so the shipped sheet is tight (the
    # master is mostly empty). Defs are rebased into these cropped coordinates.
    xs0 = min(b[0] for b, r in boxes)
    ys0 = min(b[1] for b, r in boxes)
    xs1 = max(b[2] for b, r in boxes)
    ys1 = max(b[3] for b, r in boxes)
    cx, cy = max(0, xs0 - PAD), max(0, ys0 - PAD)
    crop = im.crop((cx, cy, min(im.width, xs1 + PAD), min(im.height, ys1 + PAD)))
    crop.save(OUT_PNG, optimize=True)

    # Preserve any previously-tuned collision boxes by id.
    prev = {}
    if os.path.exists(OUT_JSON):
        try:
            prev = json.load(open(OUT_JSON)).get('assets', {})
        except Exception:
            prev = {}

    assets = {}
    for i, ((x0, y0, x1, y1), row) in enumerate(boxes):
        aid = f'block_{i:02d}'
        col = prev.get(aid, {}).get('col', dict(DEFAULT_COL))
        # Per-object size multiplier applied on top of BLOCK_SCALE in-game. The
        # crate/cube clusters on the LAST TWO ROWS render 20% smaller (they read
        # too big at the shared scale); everything else stays 1.0. Preserves a
        # hand-tuned value by id on re-run.
        size_mul = prev.get(aid, {}).get('sizeMul',
                                         0.8 if row >= n_rows - 2 else 1.0)
        assets[aid] = {'x': x0 - cx, 'y': y0 - cy, 'w': x1 - x0, 'h': y1 - y0,
                       'kind': 'block', 'col': col, 'sizeMul': size_mul}

    out = {'sheet': os.path.basename(OUT_PNG), 'assets': assets}
    json.dump(out, open(OUT_JSON, 'w'), indent=2)
    print(f'wrote {OUT_JSON}: {len(assets)} block assets across {len(rows)} rows')
    print(f'wrote {OUT_PNG}: {crop.width}x{crop.height} '
          f'(~{crop.width*crop.height*4//2**20}MB decoded)')
    for r, row in enumerate(rows):
        print(f'  row {r}: {len(row)} objects')
    return 0


if __name__ == '__main__':
    sys.exit(main())
