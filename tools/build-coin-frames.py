#!/usr/bin/env python3
"""
build-coin-frames.py — cut the spinning time-coins into UNIFORM grid sheets.

There are two masters, both 4387x381 strips holding 22 frames of one full coin
rotation in a row, floating in transparency. In both, frames 1-11 are the clock
face turning away and 12-22 the fruit face coming back round, with 11 and 22
the edge-on frames:

    01   an UPRIGHT spin, about a vertical axis. Height is constant (151px) and
         the width swings 32px edge-on to 156px face-on. Perfectly registered:
         every frame centre is at y=101.0 exactly.
    02   a TILTED / isometric spin. The coin foreshortens in both directions at
         once, so width and height move together (120x120 to 154x155), and even
         edge-on it is a diagonal bar rather than a thin sliver.

They are alternatives, not a sequence — the game picks one. Both are built, and
they share ONE cell size so switching between them cannot change the size
contract.

Two things make the master awkward to animate straight from disk, and this
script fixes both:

  * THE FRAMES ARE NOT A GRID. They are drawn by hand at irregular pitch
    (centre-to-centre runs 83px to 217px) and every frame is a different size,
    because the coin is foreshortened as it turns. So there is no cell size /
    stride that cuts either master correctly, and in 02 the closest gap between
    two frames is only 11px — a fixed 160px window centred on frame 11 would
    drag 8px of frame 12 in with it. The frames have to be lifted out
    individually and re-laid onto a grid.

  * THE COIN WANDERS — in 02. Its frame centres drift over a 13px band
    vertically, which is hand-drawing jitter rather than intent: on a coin
    spinning in place the centre should hold still, and at 12fps a 13px wobble
    on a ~140px coin is a visible shudder. Each frame is re-centred in its
    cell, which removes it. The offsets are not thrown away — they go into the
    .json as `wobble` so the look can be put back if it turns out to be wanted.
    01 is already clean and its wobble comes out all zeros.

The output is therefore the boring thing the game wants: N cells of one fixed
size, in order, so drawing frame k is `drawImage(sheet, k*CELL, 0, CELL, CELL,
...)` with no per-frame table at all.

Frames are found by their alpha, not by assuming a pitch. Note both masters
carry a 1px semi-transparent white column down their right edge (alpha 14-15,
the same sheet-border artefact the fire sheet had) — MIN_ALPHA is above it and
MIN_W discards it a second time, but if a future master shows 23 frames that
border is the first thing to suspect.

Usage:  python3 tools/build-coin-frames.py [--cell 160] [--lossy 90] [--png]
In:     assets-v2/saborosa-coin-time-NN.png   (every NN found)
Out:    assets-v2/flying-dungeon/coin/saborosa-coin-time-NN.webp  (grid sheets)
        assets-v2/flying-dungeon/coin/saborosa-coin-time.json     (both defs)
"""
import argparse
import glob
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_GLOB = os.path.join(ROOT, 'assets-v2', 'saborosa-coin-time-*.png')
DST = os.path.join(ROOT, 'assets-v2', 'flying-dungeon', 'coin')
STEM = 'saborosa-coin-time'
NAME_RE = re.compile(r'^saborosa-coin-time-(\d+)$')

# What each variant IS — for the tool's labels and for anyone reading the json.
KINDS = {
    '01': 'upright spin, vertical axis',
    '02': 'tilted / isometric spin',
}

# Above the masters' alpha-14/15 border column, below the coin's antialiased edge.
MIN_ALPHA = 32
# Narrower than this is not a frame. The thinnest real frame (01 edge-on) is 32px.
MIN_W = 16
EXPECT_FRAMES = 22
# The size contract, shared by every variant so the game can swap coins without
# touching its draw code. Both masters fit inside it; --cell 0 re-derives it.
DEFAULT_CELL = 160


def find_frames(im):
    """Frame boxes, left to right, from columns that contain any solid pixel."""
    w, h = im.size
    alpha = im.getchannel('A')
    px = alpha.load()

    solid_col = [False] * w
    for x in range(w):
        for y in range(h):
            if px[x, y] >= MIN_ALPHA:
                solid_col[x] = True
                break

    boxes, x = [], 0
    while x < w:
        if not solid_col[x]:
            x += 1
            continue
        x0 = x
        while x < w and solid_col[x]:
            x += 1
        if x - x0 < MIN_W:
            print('  ignoring %dpx sliver at x=%d (sheet border?)' % (x - x0, x0))
            continue
        strip = im.crop((x0, 0, x, h))
        top, bottom = None, None
        sp = strip.getchannel('A').load()
        for y in range(h):
            row = any(sp[i, y] >= MIN_ALPHA for i in range(x - x0))
            if row:
                if top is None:
                    top = y
                bottom = y
        boxes.append((x0, top, x, bottom + 1))
    return boxes


def measure(path):
    """Open a master and pull its frame boxes out, with a sanity check."""
    im = Image.open(path).convert('RGBA')
    boxes = find_frames(im)
    print('%-30s %dx%d  ->  %d frames'
          % (os.path.basename(path), im.width, im.height, len(boxes)))
    if not boxes:
        sys.exit('no frames found in %s' % path)
    if len(boxes) != EXPECT_FRAMES:
        print('WARNING: expected %d frames — check the cut before shipping this'
              % EXPECT_FRAMES, file=sys.stderr)
    return im, boxes


def build(im, boxes, cell):
    """Lay the frames onto a one-row grid of `cell` squares, each re-centred."""
    centres = [((x0 + x1) / 2.0, (y0 + y1) / 2.0) for x0, y0, x1, y1 in boxes]
    mean_y = sum(c[1] for c in centres) / len(centres)

    sheet = Image.new('RGBA', (cell * len(boxes), cell), (0, 0, 0, 0))
    wobble = []
    for k, (x0, y0, x1, y1) in enumerate(boxes):
        frame = im.crop((x0, y0, x1, y1))
        # Centre it. Odd leftovers round the same way every frame, so a coin
        # that grows by 2px grows symmetrically instead of drifting a pixel left.
        sheet.paste(frame, (k * cell + (cell - frame.width) // 2,
                            (cell - frame.height) // 2), frame)
        # Measured against the AVERAGE centre, so it reads as "this frame sits
        # 4px high" rather than "this frame is 280px down the master".
        wobble.append([0.0, round(centres[k][1] - mean_y, 1)])
    return sheet, wobble, centres


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cell', type=int, default=DEFAULT_CELL,
                    help='square cell size, shared by every variant; '
                         '0 = the largest frame across all of them + --pad')
    ap.add_argument('--pad', type=int, default=4,
                    help='breathing room around the largest frame when --cell is 0')
    ap.add_argument('--lossy', type=int, default=0,
                    help='webp quality 1-100; default 0 = LOSSLESS (flat line art, '
                         'lossy rings on the black outlines)')
    ap.add_argument('--png', action='store_true', help='also write each sheet as png')
    ap.add_argument('--only', default=None, metavar='NN',
                    help='build just one variant (e.g. --only 01)')
    ap.add_argument('--glob', default=SRC_GLOB)
    args = ap.parse_args()

    masters = []
    for p in sorted(glob.glob(args.glob)):
        m = NAME_RE.match(os.path.splitext(os.path.basename(p))[0])
        if not m:
            print('skipping unrecognised name: %s' % os.path.basename(p))
            continue
        if args.only and m.group(1) != args.only:
            continue
        masters.append((m.group(1), p))
    if not masters:
        sys.exit('no coin masters matched %s' % args.glob)

    measured = [(key, path) + measure(path) for key, path in masters]

    # ONE cell for every variant. Sized off the largest frame anywhere, not
    # per-variant, so a variant swap is a filename change and nothing else —
    # if 01 and 02 had different cells the game would have to rescale on swap.
    biggest = max(max(max(x1 - x0, y1 - y0) for x0, y0, x1, y1 in boxes)
                  for _k, _p, _im, boxes in measured)
    cell = args.cell or (biggest + 2 * args.pad)
    if cell < biggest:
        sys.exit('--cell %d is smaller than the largest frame found (%dpx)' % (cell, biggest))
    print('\nlargest frame anywhere %dpx  ->  shared cell %dx%d\n' % (biggest, cell, cell))

    os.makedirs(DST, exist_ok=True)
    variants = {}
    for key, path, im, boxes in measured:
        sheet, wobble, centres = build(im, boxes, cell)
        name = '%s-%s' % (STEM, key)
        out = os.path.join(DST, name + '.webp')
        if args.lossy:
            sheet.save(out, 'WEBP', quality=args.lossy, method=6)
        else:
            sheet.save(out, 'WEBP', lossless=True, quality=100, method=6)
        if args.png:
            sheet.save(os.path.join(DST, name + '.png'), 'PNG', optimize=True)

        sizes = [(x1 - x0, y1 - y0) for x0, y0, x1, y1 in boxes]
        pitch = [centres[i + 1][0] - centres[i][0] for i in range(len(centres) - 1)]
        variants[key] = {
            'sheet': name + '.webp',
            'source': os.path.basename(path),
            'kind': KINDS.get(key, ''),
            'frames': len(boxes),
            # Sub-ranges worth animating on their own. Frames 11 and 22 are the
            # edge-on ones, i.e. where the coin has turned exactly side-on, so
            # they are the seams a half-spin has to start and end on.
            'ranges': {
                'spin': [1, len(boxes)],
                'clockFace': [1, 11],
                'fruitFace': [12, len(boxes)],
            },
            'wobble': wobble,
            'srcBoxes': [[x0, y0, x1 - x0, y1 - y0] for x0, y0, x1, y1 in boxes],
        }

        si, so = os.path.getsize(path), os.path.getsize(out)
        wob = max(abs(w[1]) for w in wobble)
        print('%-28s %5dx%-4d %5.0fKB -> %5.0fKB   frames %dx%d..%dx%d   '
              'pitch %.0f..%.0f   wobble +-%.1fpx'
              % (os.path.basename(out), sheet.width, sheet.height, si / 1e3, so / 1e3,
                 min(s[0] for s in sizes), min(s[1] for s in sizes),
                 max(s[0] for s in sizes), max(s[1] for s in sizes),
                 min(pitch), max(pitch), wob))

    defs = {
        'cell': [cell, cell],
        'rows': 1,
        'registration': 'bbox-centre, re-centred per cell',
        'default': '02' if '02' in variants else sorted(variants)[0],
        'variants': variants,
    }
    # --only rewrites one variant, so merge rather than dropping the other.
    defpath = os.path.join(DST, STEM + '.json')
    if args.only and os.path.exists(defpath):
        try:
            old = json.load(open(defpath))
            if old.get('cell') == defs['cell']:
                merged = dict(old.get('variants', {}))
                merged.update(variants)
                defs['variants'] = merged
            else:
                print('note: cell changed, rewriting the whole def', file=sys.stderr)
        except (ValueError, OSError):
            pass
    with open(defpath, 'w') as f:
        json.dump(defs, f, indent=2)

    print('\n%d variant(s), shared %dpx cell (%s)   def: %s'
          % (len(variants), cell, 'lossless' if not args.lossy else 'q%d' % args.lossy,
             defpath))


if __name__ == '__main__':
    main()
