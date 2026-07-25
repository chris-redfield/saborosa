#!/usr/bin/env python3
"""
build-hustlebar.py — the Time Boss's health bar.

The master (`assets-v2/saborosa-hustlebar-1-low.png`) is a contact sheet of
hand-drawn VERTICAL bars, 11 squares each, in two rows. Read as a ladder they
are one bar at every state it can be in:

    WWWWWWWWWWW   empty — the boss is dead
    WWWWWWWWWWY   yellow rises from the BOTTOM
    ...
    WYYYYYYYYYY
    YYYYYYYYYYY   ← NOT ON THE SHEET. This script draws it.
    RYYYYYYYYYY   red then descends from the TOP
    ...
    RRRRRRRRRRR   full — the boss at full health

So the level of a bar is `(11 - whites) + reds`: 0..22, twenty-three states, of
which the master has twenty-two. The missing one is the changeover — the instant
the bar is all yellow and no red is left — and it is missing because it is the
only state that is neither "some white" nor "some red". It is generated here
from the WYYYYYYYYYY bar by tinting its one white square yellow.

⚠️ THE TINT IS A MULTIPLY, not a fill. The squares are ink drawings: a flat fill
would eat the black outline and the pencil texture inside it. Multiplying by the
yellow sampled from the square below maps white→yellow and black→black and every
antialiased grey in between to a darker yellow — which is exactly what the artist
drew in the other ten squares.

The bars come out HORIZONTAL: each is rotated 90° anticlockwise, so the vertical
bar's bottom (where the yellow starts) ends up on the RIGHT. Full health is then
a solid red bar that drains right-to-left, the way a health bar is read.

⚠️ AND THE WHITE FRAMES ARE THEN MIRRORED. In the master the two phases fill
from OPPOSITE ends — yellow rises from the bottom, red descends from the top —
so once rotated, the red drains right-to-left but the white would eat in from
the left. Same bar, two contradictory directions. Mirroring every frame that
contains white flips the second phase to match the first, so the remaining
health is always anchored at the LEFT end and the bar empties one way throughout.
The wobble of the ink flips with it, but every bar on the sheet is drawn
separately and already differs frame to frame, so nothing reads as a seam.

Output is one column of 23 uniform cells — frame k is (0, k*CELL_H, CELL_W,
CELL_H), no per-frame table — written lossless (flat ink art; lossy rings the
outlines) to the flying dungeon's asset root, which package.sh already globs.

    python3 tools/build-hustlebar.py
"""
import os
import sys
from collections import Counter

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MASTER = os.path.join(ROOT, 'assets-v2', 'saborosa-hustlebar-1-low.png')
OUT_DIR = os.path.join(ROOT, 'assets-v2', 'flying-dungeon')
OUT = os.path.join(OUT_DIR, 'saborosa-hustlebar.webp')

CELLS = 11          # squares per bar
INK = 90            # below this on all channels is the outline, not a fill


def bands(occ, gap):
    """Runs of non-empty entries, merging gaps shorter than `gap`."""
    out, start, last = [], None, None
    for i, n in enumerate(occ):
        if n > 0:
            if start is None:
                start = i
            last = i
        elif start is not None and i - last > gap:
            out.append((start, last))
            start = None
    if start is not None:
        out.append((start, last))
    return out


def classify(p):
    r, g, b = p[:3]
    if r > 200 and g > 200 and b > 200:
        return 'W'
    if r > 200 and g > 170 and b < 120:
        return 'Y'
    if r > 180 and g < 130:
        return 'R'
    return '?'


def read_cells(px, x0, x1, y0, y1):
    """The 11 squares of one bar, top to bottom, as W/Y/R."""
    out = []
    ch = (y1 - y0 + 1) / float(CELLS)
    cx = (x0 + x1) // 2
    for k in range(CELLS):
        cy = int(y0 + ch * (k + 0.5))
        c = Counter()
        for dy in range(-4, 5):
            for dx in range(-6, 7):
                p = px[cx + dx, cy + dy]
                if p[3] < 40:
                    continue
                if p[0] < INK and p[1] < INK and p[2] < INK:
                    continue                      # the outline, not the fill
                c[classify(p)] += 1
        out.append(c.most_common(1)[0][0] if c else '.')
    return ''.join(out)


def modal_colour(im, box, want):
    """The most common fill colour of `want` ('Y') inside a box."""
    c = Counter()
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]):
            p = im.getpixel((x, y))
            if p[3] < 200:
                continue
            if p[0] < INK and p[1] < INK and p[2] < INK:
                continue
            if classify(p) == want:
                c[p[:3]] += 1
    if not c:
        sys.exit('no %s pixels found to sample' % want)
    return c.most_common(1)[0][0]


def main():
    if not os.path.exists(MASTER):
        sys.exit('missing master: %s' % MASTER)
    im = Image.open(MASTER).convert('RGBA')
    w, h = im.size
    px = im.load()

    rows = bands([sum(1 for x in range(w) if px[x, y][3] > 20) for y in range(h)], 20)
    found = {}
    for (y0, y1) in rows:
        cols = bands([sum(1 for y in range(y0, y1 + 1) if px[x, y][3] > 20) for x in range(w)], 8)
        for (x0, x1) in cols:
            cells = read_cells(px, x0, x1, y0, y1)
            if '?' in cells or '.' in cells:
                sys.exit('unreadable bar at x%d y%d: %s' % (x0, y0, cells))
            level = (CELLS - cells.count('W')) + cells.count('R')
            if level in found:
                sys.exit('two bars claim level %d' % level)
            found[level] = (x0, y0, x1, y1, cells)

    total = CELLS * 2 + 1
    missing = [k for k in range(total) if k not in found]
    print('%d bars read, levels %d..%d, missing %s'
          % (len(found), min(found), max(found), missing))
    if missing != [CELLS]:
        sys.exit('expected only the all-yellow bar (level %d) to be missing' % CELLS)

    # --- Draw the missing bar -------------------------------------------------
    # Level 10 is WYYYYYYYYYY: the same bar with its top square still white.
    x0, y0, x1, y1, cells = found[CELLS - 1]
    src = im.crop((x0, y0, x1 + 1, y1 + 1))
    cw, ch = src.size
    cell_h = ch / float(CELLS)
    yellow = modal_colour(src, (0, int(cell_h * 1.2), cw, int(cell_h * 2.8)), 'Y')
    print('sampled yellow %s from the square below' % (yellow,))

    made = src.copy()
    mp = made.load()
    # MULTIPLY over the top square only. White → yellow, ink → ink, and every
    # antialiased grey between them → a darker yellow, which is what the other
    # ten squares actually contain.
    for y in range(0, int(round(cell_h)) + 1):
        for x in range(cw):
            r, g, b, a = mp[x, y]
            if a == 0:
                continue
            mp[x, y] = (r * yellow[0] // 255, g * yellow[1] // 255,
                        b * yellow[2] // 255, a)
    found[CELLS] = ('generated', made)

    # --- Lay them out ---------------------------------------------------------
    # Rotated so the bar reads left-to-right, then centred in a uniform cell:
    # the bars are hand-drawn and differ by a pixel or two, and a common cell is
    # what stops the bar twitching sideways every time the frame changes.
    frames = []
    for k in range(total):
        f = found[k]
        crop = f[1] if f[0] == 'generated' else im.crop((f[0], f[1], f[2] + 1, f[3] + 1))
        bar = crop.rotate(90, expand=True)            # PIL rotates anticlockwise
        # The white phase fills from the wrong end — see the header. Levels below
        # CELLS are exactly the ones with white in them.
        if k < CELLS:
            bar = bar.transpose(Image.FLIP_LEFT_RIGHT)
        frames.append(bar)

    cw = max(f.size[0] for f in frames)
    ch = max(f.size[1] for f in frames)
    sheet = Image.new('RGBA', (cw, ch * total), (0, 0, 0, 0))
    for k, f in enumerate(frames):
        sheet.alpha_composite(f, ((cw - f.size[0]) // 2,
                                  k * ch + (ch - f.size[1]) // 2))

    os.makedirs(OUT_DIR, exist_ok=True)
    sheet.save(OUT, lossless=True, quality=100, method=6)
    print('%d frames, cell %dx%d -> %s (%.0fKB)'
          % (total, cw, ch, OUT, os.path.getsize(OUT) / 1024))
    print('set BAR_CELL_W: %d, BAR_CELL_H: %d, BAR_FRAMES: %d in config.js'
          % (cw, ch, total))


if __name__ == '__main__':
    main()
