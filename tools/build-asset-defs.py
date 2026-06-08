#!/usr/bin/env python3
"""Extract decorative map-asset bounding boxes from a transparent sprite sheet.

Detects each asset on assets/saborosa-assets-001.png by alpha, merges nearby
parts (a fruit and its stem, a tuft's clumps) with a dilation pass, groups the
results into rows, and writes a definitions JSON the game + map editor load.

Each asset also carries a normalized `col` red-collision box (offX/offY/w/h as
fractions of the sprite). New assets seed a bottom-center default; if the output
file already exists, previously-tuned `col` boxes are PRESERVED by id so a
re-run never clobbers hand edits made in the map editor.

Run from the project root:  python3 tools/build-asset-defs.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

A = 'assets/'
SHEET = 'saborosa-assets-001.png'
OUT = A + 'saborosa-assets-001-sprites.json'

# Row order on the sheet (top to bottom) -> id prefix for that category.
ROW_PREFIXES = ['fruit', 'shape', 'plant', 'grass', 'tree']

# Default red-collision box (normalized): a bottom-center footprint, like rocks.
DEFAULT_COL = {'offX': 0.20, 'offY': 0.78, 'w': 0.60, 'h': 0.20}

ALPHA_THRESH = 30      # opaque if alpha > this
DILATE = 25            # px; merges stems/clumps into one component
MIN_AREA = 800         # drop specks smaller than this many opaque px
ROW_GAP = 400          # px between row centers to start a new row


def detect_boxes(alpha):
    """Return [[x0,y0,x1,y1], ...] tight boxes, grouped+ordered row-major."""
    mask = alpha > ALPHA_THRESH
    dil = ndimage.binary_dilation(mask, np.ones((DILATE, DILATE), bool))
    lbl, n = ndimage.label(dil)
    slices = ndimage.find_objects(lbl)
    boxes = []
    for i, sl in enumerate(slices):
        ys, xs = sl
        comp = (lbl[sl] == i + 1) & mask[sl]   # tighten to real (undilated) px
        if comp.sum() < MIN_AREA:
            continue
        yy, xx = np.where(comp)
        boxes.append([int(xs.start + xx.min()), int(ys.start + yy.min()),
                      int(xs.start + xx.max() + 1), int(ys.start + yy.max() + 1)])

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
    for r, row in enumerate(rows):
        prefix = ROW_PREFIXES[r] if r < len(ROW_PREFIXES) else f'row{r}'
        for i, (x0, y0, x1, y1) in enumerate(row):
            aid = f'{prefix}_{i:02d}'
            col = prev.get(aid, {}).get('col', dict(DEFAULT_COL))
            assets[aid] = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'col': col}

    out = {'sheet': SHEET, 'assets': assets}
    json.dump(out, open(OUT, 'w'), indent=2)
    print(f'wrote {OUT}: {len(assets)} assets across {len(rows)} rows')
    for r, row in enumerate(rows):
        prefix = ROW_PREFIXES[r] if r < len(ROW_PREFIXES) else f'row{r}'
        print(f'  {prefix}: {len(row)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
