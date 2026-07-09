#!/usr/bin/env python3
"""Extract the sleeping-rock enemy sheet into defs + a cropped game PNG.

Unlike the playable-character sheets (a uniform 9-col x 5-row grid, see
build-character-defs.py), the rock sheet `saborosa-bonecos-rock-low.png` has TWO
blocks separated by a wide empty gutter, both 5 rows (directions: down,
down_left, left, up_left, up):

  LEFT block  — 7 columns: the WAKE-UP progression.
                col 0      = fully asleep (a plain rock, no eyes/feet)
                cols 1..5  = rising: eyes open, feet grow, stands up
                col 6      = idle standing (fully awake, angry, on its feet)
  RIGHT block — 3 columns: the WALK cycle (used once awake and moving).

The rock entity (src/entities/rockenemy.js) plays cols 0->6 forward to wake and
6->0 in reverse to fall back asleep, holds col 6 as its awake idle, col 0 as its
sleeping pose, and cycles the walk block while roaming/chasing.

Same shipping strategy as the character sheets: the art is drawn at small cells
in a mostly-empty canvas, so downscaling would only blur it. We CROP the master
to its content bbox and ship it 1:1 (game sheetScale = 1.0).

Outputs (assets/):
  saborosa-elementos-rock-game.png      cropped, full-res game sheet
  saborosa-elementos-rock-sprites.json  { wake:[35], walk:[15], rows, wakeCols, walkCols }
"""
import json
import sys
import numpy as np
from PIL import Image

SRC = 'assets-v2/saborosa-bonecos-rock-low.png'
OUT = 'assets/'
ROWS = 5
WAKE_COLS = 7   # left block
WALK_COLS = 3   # right block
PAD = 8         # transparent margin kept around the content crop


def bands(proj):
    """Contiguous runs of True -> list of (start, end) inclusive."""
    out, inb, s = [], False, 0
    for i, v in enumerate(proj):
        if v and not inb:
            inb, s = True, i
        elif not v and inb:
            inb = False
            out.append((s, i - 1))
    if inb:
        out.append((s, len(proj) - 1))
    return out


def tight_bbox(alpha, x0, x1, y0, y1):
    """Tight opaque bbox within [x0,x1]x[y0,y1] (inclusive band rect)."""
    sub = alpha[y0:y1 + 1, x0:x1 + 1] > 20
    ys, xs = np.where(sub)
    return [int(x0 + xs.min()), int(y0 + ys.min()),
            int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]


def main():
    im = Image.open(SRC).convert('RGBA')
    alpha = np.array(im)[:, :, 3]
    op = alpha > 20
    cb = bands(op.sum(axis=0) >= 1)
    rb = bands(op.sum(axis=1) >= 1)
    total_cols = WAKE_COLS + WALK_COLS
    assert len(cb) == total_cols, f'found {len(cb)} col bands, want {total_cols}'
    assert len(rb) == ROWS, f'found {len(rb)} row bands, want {ROWS}'

    # Per-cell tight crops in MASTER coords, split into the two blocks. Both
    # blocks share the same row bands (they sit at the same Y).
    wake_cells, walk_cells = [], []
    for r in range(ROWS):
        ry0, ry1 = rb[r]
        for c in range(WAKE_COLS):
            cx0, cx1 = cb[c]
            wake_cells.append(tight_bbox(alpha, cx0, cx1, ry0, ry1))
        for c in range(WAKE_COLS, total_cols):
            cx0, cx1 = cb[c]
            walk_cells.append(tight_bbox(alpha, cx0, cx1, ry0, ry1))

    all_cells = wake_cells + walk_cells
    xs0 = min(x for x, y, w, h in all_cells)
    ys0 = min(y for x, y, w, h in all_cells)
    xs1 = max(x + w for x, y, w, h in all_cells)
    ys1 = max(y + h for x, y, w, h in all_cells)
    cx, cy = max(0, xs0 - PAD), max(0, ys0 - PAD)
    crop = im.crop((cx, cy, min(im.width, xs1 + PAD), min(im.height, ys1 + PAD)))
    crop.save(f'{OUT}saborosa-elementos-rock-game.png', optimize=True)

    def rebase(cells):
        return [{'x': x - cx, 'y': y - cy, 'w': w, 'h': h}
                for x, y, w, h in cells]

    out = {
        'wake': rebase(wake_cells),
        'walk': rebase(walk_cells),
        'rows': ROWS,
        'wakeCols': WAKE_COLS,
        'walkCols': WALK_COLS,
    }
    path = f'{OUT}saborosa-elementos-rock-sprites.json'
    with open(path, 'w') as f:
        json.dump(out, f, indent=2)
    idle = out['wake'][WAKE_COLS - 1]  # row 0 idle-standing cell
    print(f'rock: {len(wake_cells)} wake + {len(walk_cells)} walk frames, '
          f'crop {crop.width}x{crop.height} '
          f'(~{crop.width*crop.height*4//2**20}MB) -> {path}  '
          f'idle cell {idle["w"]}x{idle["h"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
