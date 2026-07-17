#!/usr/bin/env python3
"""Extract the assets-v2 character sheets into the `{frames, cols, rows}` defs
the rich sprite loader (spritesheet.js) reads, plus a cropped game PNG.

Both new sheets (saborosa-elementos-coconut.png / -tomato.png) share one layout:
a 9-col x 5-row grid. Rows are directions (down, down_left, left, up_left, up);
columns are poses (see spritesheet.js for the idle/grab/throw/action mapping).
This is the OLD 10-col coconut layout minus its dedicated idle column — col 0
now doubles as the resting pose.

Unlike the block/coconut sheets (authored at ~580px cells, shipped downscaled),
the new art is drawn at small cells (~120px) inside a mostly-empty 5543x4071
canvas. Downscaling would only blur it; instead we CROP the master to its
content bbox and ship it 1:1 (game sheetScale = 1.0). That copy is tiny
(~4MB decoded vs ~90MB for the full master) and as crisp as the source allows.

Outputs (assets/):
  saborosa-elementos-<name>-game.png      cropped, full-res game sheet
  saborosa-elementos-<name>-sprites.json  frames in cropped-sheet coords
"""
import json
import sys
import numpy as np
from PIL import Image

SRC = 'assets-v2/'
OUT = 'assets/'
COLS, ROWS = 9, 5
PAD = 8  # transparent margin kept around the content crop
# (master filename in assets-v2/, output basename). Every master shares the
# 9x5 layout above; the newer `bonecos … low` skins just use a different source
# naming, so we map each explicitly instead of templating off the name.
SHEETS = [
    ('saborosa-elementos-coconut.png',         'coconut'),
    ('saborosa-elementos-tomato.png',          'tomato'),
    ('saborosa-bonecos-eggplant low.png',      'eggplant'),
    # ERKPA's beaten-up skin, shown after his first death. Same 9x5 layout as
    # the alive master, so it packs through the identical path.
    ('saborosa-bonecos-eggplant-dead-low.png', 'eggplant-dead'),
    ('saborosa-bonecos-laranja low.png',       'laranja'),
    # JUIXY's beaten-up skin (the yellow "laranja" pack, index 3), shown after
    # his first death — the citrus art reads as a lemon, hence the master name.
    # Same 9x5 layout as the alive master, so it packs through the identical path.
    ('saborosa-bonecos-lemon-dead-1-low.png',  'laranja-dead'),
    # TOM's beaten-up skins (the red "tomato" pack, index 0), a two-stage
    # progression: dead-1 after his first death, dead-2 (last life) after his
    # second. Same 9x5 layout as the alive master.
    ('saborosa-bonecos-tomato-dead-1.png',     'tomato-dead'),
    ('saborosa-bonecos-tomato-dead-2-low.png', 'tomato-dead2'),
]


def bands(proj):
    """Contiguous runs of True → list of (start, end) inclusive."""
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
    # Optional args = build only those output basenames (e.g. `eggplant-dead`),
    # so regenerating one skin doesn't rewrite the others' game PNGs.
    only = set(sys.argv[1:])
    for src, name in SHEETS:
        if only and name not in only:
            continue
        im = Image.open(f'{SRC}{src}').convert('RGBA')
        alpha = np.array(im)[:, :, 3]
        op = alpha > 20
        # A real row/column of sprites spans hundreds of opaque px at its peak;
        # a handful of stray pixels sitting a few px outside the grid (e.g. the
        # dead-eggplant master has 2 specks below the last row) would otherwise
        # read as a phantom extra band. Detect bands generously (>=1, so real
        # band bounds stay pixel-exact) then drop any whose peak is negligible.
        BAND_MIN_PEAK = 20  # << thinnest real band peak (~700), >> a speck (~2)
        colp, rowp = op.sum(axis=0), op.sum(axis=1)
        cb = [b for b in bands(colp >= 1) if colp[b[0]:b[1] + 1].max() >= BAND_MIN_PEAK]
        rb = [b for b in bands(rowp >= 1) if rowp[b[0]:b[1] + 1].max() >= BAND_MIN_PEAK]
        assert len(cb) == COLS, f'{name}: found {len(cb)} col bands, want {COLS}'
        assert len(rb) == ROWS, f'{name}: found {len(rb)} row bands, want {ROWS}'

        # Per-cell tight crops in MASTER coords (row-major reading order).
        cells = []
        for r in range(ROWS):
            ry0, ry1 = rb[r]
            for c in range(COLS):
                cx0, cx1 = cb[c]
                cells.append(tight_bbox(alpha, cx0, cx1, ry0, ry1))

        # Content bbox over all cells → crop the master, rebase coords.
        xs0 = min(x for x, y, w, h in cells)
        ys0 = min(y for x, y, w, h in cells)
        xs1 = max(x + w for x, y, w, h in cells)
        ys1 = max(y + h for x, y, w, h in cells)
        cx, cy = max(0, xs0 - PAD), max(0, ys0 - PAD)
        crop = im.crop((cx, cy, min(im.width, xs1 + PAD),
                        min(im.height, ys1 + PAD)))
        crop.save(f'{OUT}saborosa-elementos-{name}-game.png', optimize=True)

        frames = [{'x': x - cx, 'y': y - cy, 'w': w, 'h': h}
                  for x, y, w, h in cells]
        out = {'frames': frames, 'cols': COLS, 'rows': ROWS}
        path = f'{OUT}saborosa-elementos-{name}-sprites.json'
        with open(path, 'w') as f:
            json.dump(out, f, indent=2)
        idle = frames[0]
        print(f'{name}: 45 frames, crop {crop.width}x{crop.height} '
              f'(~{crop.width*crop.height*4//2**20}MB) -> {path}  '
              f'idle cell {idle["w"]}x{idle["h"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
