#!/usr/bin/env python3
"""
Cut the hand-drawn "GO!" out of the title lettering sheet.

Source: assets/saborosa-letras-01.png (5994x3549) — the same sheet
tools/build-letter-defs.py takes the SABOROSA glyphs from, and the same one the
intro's pointing hand came off. It holds the whole game's hand-lettered UI
vocabulary twice over: a WHITE-FILL version on the left half and a YELLOW-FILL
version on the right.

    MISTER EGG               MISTER EGG
    (hand) -START            (hand) -START
    (thumb) -OPTIONS         (thumb) -OPTIONS
            GO!                      GO!        <- this one
    VOLUME -OFF -ON          VOLUME -OFF -ON
    THE END                  THE END
    SABOROSA                 SABOROSA

THE CROP IS FOUND, NOT HARD-CODED. The bbox below is derived by projection —
content rows in the yellow half, then content columns inside the band, then the
tight box of the run that GO! occupies. Hard-coded pixel coordinates off a
5994px master are exactly the kind of thing that silently cuts half a glyph when
the art is re-exported, which is the fire-sheet lesson recorded in the main
README. The numbers are printed on every run so a change is visible.

BOTH FILLS ARE CUT, from the SAME box. The white version is the left half's
copy at the identical offset, so the two are pixel-aligned and can be
crossfaded — the trick the SABOROSA letters already use for their yellow/white
flicker. The beat 'em up only draws the yellow one today; the white is built so
that choosing to flicker later is a draw-code change and not another trip
through this script.

Output (assets-v2/beatemup-dungeon/):
    saborosa-go.png         yellow fill, transparent background
    saborosa-go-white.png   white fill, same box, pixel-aligned

Usage:  python3 beatemup-dungeon/tools/build-go-glyph.py       (from the repo root)
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets', 'saborosa-letras-01.png')
OUT = os.path.join(ROOT, 'assets-v2', 'beatemup-dungeon')

PAD = 10          # transparent margin kept around the crop

# The region GO! lives in, as a fraction of the sheet. Generous on purpose — it
# only has to land on the right COLUMN of the sheet (the yellow half, clear of
# the hand and thumb); which word inside it is GO! is decided below.
SEARCH_Y = (0.25, 0.56)
SEARCH_X = (0.63, 0.90)

# Rows this far apart or more count as separate words.
ROW_GAP = 24


def masks(a):
    """Yellow fill and black ink, the same classifiers build-letter-defs.py uses."""
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    yellow = (al > 40) & (r > 150) & (g > 140) & (b < 150)
    ink = (al > 40) & (r < 100) & (g < 100) & (b < 100)
    return yellow, ink


def tight(mask):
    """Tight bbox of a boolean mask, or None."""
    ys = np.where(mask.any(axis=1))[0]
    xs = np.where(mask.any(axis=0))[0]
    if not len(ys) or not len(xs):
        return None
    return xs[0], ys[0], xs[-1], ys[-1]


def row_runs(mask, gap):
    """Contiguous bands of non-empty rows, merged across gaps under `gap`."""
    rows = mask.any(axis=1)
    runs, start, blank = [], None, 0
    for i, v in enumerate(rows):
        if v:
            if start is None:
                start = i
            blank = 0
        elif start is not None:
            blank += 1
            if blank >= gap:
                runs.append((start, i - blank))
                start = None
    if start is not None:
        runs.append((start, len(rows) - 1))
    return runs


def main():
    if not os.path.exists(SRC):
        sys.exit('ERROR: source sheet not found: %s' % SRC)
    im = Image.open(SRC).convert('RGBA')
    a = np.asarray(im)
    H, W = a.shape[:2]
    yellow, ink = masks(a)
    content = yellow | ink

    y0, y1 = int(H * SEARCH_Y[0]), int(H * SEARCH_Y[1])
    x0, x1 = int(W * SEARCH_X[0]), int(W * SEARCH_X[1])
    win = content[y0:y1, x0:x1]

    # The window spans several words (OPTIONS above, VOLUME below), so its
    # overall bbox is NOT the glyph — taking it whole drags slices of both
    # neighbours in. Split into word bands and pick GO! by being the TALLEST:
    # it is set several times the size of the menu items around it, which is a
    # property of the lettering rather than of where it happens to sit, so it
    # survives the sheet being re-laid out.
    runs = row_runs(win, ROW_GAP)
    if not runs:
        sys.exit('ERROR: nothing found in the GO! search window — has the sheet changed?')
    print('word bands in window:')
    for s, e in runs:
        print('   y %d..%d  (h=%d)' % (y0 + s, y0 + e, e - s + 1))
    rs, re_ = max(runs, key=lambda r: r[1] - r[0])

    band = win[rs:re_ + 1]
    box = tight(band)
    if box is None:
        sys.exit('ERROR: the chosen band is empty.')
    bx0, by0, bx1, by1 = box
    gx0, gy0 = x0 + bx0, y0 + rs + by0
    gx1, gy1 = x0 + bx1, y0 + rs + by1
    print('sheet         %dx%d' % (W, H))
    print('GO! (yellow)  x %d..%d  y %d..%d  (%dx%d)'
          % (gx0, gx1, gy0, gy1, gx1 - gx0 + 1, gy1 - gy0 + 1))

    # The white twin sits half a sheet to the left, at the same offset — the two
    # halves are the same artwork drawn twice, so one shift lands on it.
    half = W // 2
    wx0, wx1 = gx0 - half, gx1 - half
    if wx0 < 0:
        sys.exit('ERROR: the white half would start off-sheet — check SEARCH_X.')
    print('GO! (white)   x %d..%d  y %d..%d' % (wx0, wx1, gy0, gy1))

    os.makedirs(OUT, exist_ok=True)
    for name, cx0, cx1 in (('saborosa-go.png', gx0, gx1),
                           ('saborosa-go-white.png', wx0, wx1)):
        crop = im.crop((max(0, cx0 - PAD), max(0, gy0 - PAD),
                        min(W, cx1 + 1 + PAD), min(H, gy1 + 1 + PAD)))
        path = os.path.join(OUT, name)
        crop.save(path)
        print('wrote %-26s %dx%d  %.0f KB'
              % (name, crop.width, crop.height, os.path.getsize(path) / 1024))


if __name__ == '__main__':
    main()
