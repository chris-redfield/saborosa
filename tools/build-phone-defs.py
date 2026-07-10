#!/usr/bin/env python3
"""Extract the telephone enemy sheet into defs + a cropped game PNG.

Unlike the sleeper sheets (a two-block wake/walk layout, see build-rock-defs.py),
the phone sheet `saborosa-bonecos-phone-low.png` (2879x1420, the same "bonecos
low" canvas as the characters) is a plain 8-column x 3-row grid — NO wake block:

  cols 0..7 = the 8 facings:
              down, down_left, left, up_left, up, up_right, right, down_right
  row 0     = NORMAL   (roaming / chasing pose)
  row 1     = NERVOUS  (a startled reaction the instant it spots the player)
  row 2     = HURT     (reserved — plays when a thrown object hits it; unused now)

One frame per (facing, state): the phone has no walk sub-cycle, it just slides its
single directional pose around. Shipped like the character/sleeper sheets: the art
sits in small cells on a mostly-empty canvas, so we CROP to the content bbox and
ship 1:1 (game sheetScale = 1.0), rather than downscaling and blurring it.

Outputs (assets/):
  saborosa-elementos-phone-game.png      cropped, full-res game sheet
  saborosa-elementos-phone-sprites.json  { cols, rows, dirs, states, cells:{state:[8]} }
"""
import json
import numpy as np
from PIL import Image

SRC = 'assets-v2/saborosa-bonecos-phone-low.png'
OUT = 'assets/'
COLS = 8
ROWS = 3
PAD = 8  # transparent margin kept around the content crop
# Column -> facing. The sheet walks the compass CLOCKWISE from front: each side
# column depicts the phone facing the OPPOSITE screen side to a naive read (col 2
# is drawn facing right, col 6 facing left), so the left/right halves are mirrored
# relative to the column order. down/up are symmetric and unaffected.
DIRS = ['down', 'down_right', 'right', 'up_right', 'up', 'up_left', 'left', 'down_left']
# Row -> emotional state.
STATES = ['normal', 'nervous', 'hurt']


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
    """Tight opaque bbox within the [x0,x1]x[y0,y1] band cell (inclusive)."""
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
    assert len(cb) == COLS, f'found {len(cb)} col bands, want {COLS}'
    assert len(rb) == ROWS, f'found {len(rb)} row bands, want {ROWS}'

    cells = []  # row-major, 24 tight crops in MASTER coords
    for r in range(ROWS):
        ry0, ry1 = rb[r]
        for c in range(COLS):
            cx0, cx1 = cb[c]
            cells.append(tight_bbox(alpha, cx0, cx1, ry0, ry1))

    xs0 = min(x for x, y, w, h in cells)
    ys0 = min(y for x, y, w, h in cells)
    xs1 = max(x + w for x, y, w, h in cells)
    ys1 = max(y + h for x, y, w, h in cells)
    cx, cy = max(0, xs0 - PAD), max(0, ys0 - PAD)
    crop = im.crop((cx, cy, min(im.width, xs1 + PAD), min(im.height, ys1 + PAD)))
    crop.save(f'{OUT}saborosa-elementos-phone-game.png', optimize=True)

    def rebase(cell):
        x, y, w, h = cell
        return {'x': x - cx, 'y': y - cy, 'w': w, 'h': h}

    out_cells = {}
    for ri, st in enumerate(STATES):
        out_cells[st] = [rebase(cells[ri * COLS + c]) for c in range(COLS)]

    out = {'cols': COLS, 'rows': ROWS, 'dirs': DIRS, 'states': STATES, 'cells': out_cells}
    path = f'{OUT}saborosa-elementos-phone-sprites.json'
    with open(path, 'w') as f:
        json.dump(out, f, indent=2)

    ref = out_cells['normal'][0]
    print(f'phone: {COLS * ROWS} frames, crop {crop.width}x{crop.height} '
          f'(~{crop.width * crop.height * 4 // 2**20}MB) -> {path}  '
          f'down-normal cell {ref["w"]}x{ref["h"]}')


if __name__ == '__main__':
    main()
