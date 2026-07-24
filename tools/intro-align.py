#!/usr/bin/env python3
"""
intro-align.py — find how far the camera should ACTUALLY roll between two
intro panels.

The roll assumed each panel is a fresh screen, so it travelled a full canvas
height between them. But the boards that "go down" are overlapping crops of one
taller scene: panel B's top is panel A's bottom, re-photographed lower. Roll a
full screen and that shared band gets shown twice — the seam the eye catches.

This slides B up under A over every candidate offset and scores the overlap
(mean abs difference on greyscale, normalised), so the best dy is the one where
the shared content actually lines up. dy == H means "no overlap, they really are
separate screens".

Usage:  python3 tools/intro-align.py [--pairs 3,4 6,7] [--all]
"""
import argparse
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'assets-v2', 'flying-dungeon')

MIN_OVERLAP = 40      # px — below this there's not enough evidence to trust a match


def load(i):
    p = os.path.join(DST, 'saborosa-intro-%02d.webp' % i)
    return np.asarray(Image.open(p).convert('L'), dtype=np.float32)


def score_offsets(a, b):
    """For each dy, how well does b[0:H-dy] match a[dy:H]? Lower = better."""
    H = a.shape[0]
    out = []
    for dy in range(MIN_OVERLAP, H + 1):
        ov = H - dy
        if ov < MIN_OVERLAP:
            out.append((dy, None, ov))
            continue
        diff = np.abs(a[dy:, :] - b[:ov, :]).mean()
        out.append((dy, diff, ov))
    return out


def analyse(i, j, verbose=True):
    a, b = load(i), load(j)
    H = a.shape[0]
    scored = [(dy, d, ov) for dy, d, ov in score_offsets(a, b) if d is not None]

    best_dy, best_d, best_ov = min(scored, key=lambda r: r[1])

    # A true registration is a SHARP, isolated minimum: nudge off it by a few px
    # and the score collapses. A flat band (or two panels that are the same photo
    # under different text) scores low everywhere, so the winner is meaningless.
    # Compare the winner to the best score OUTSIDE a small window around it.
    WIN = 12
    outside = [d for dy, d, _ in scored if abs(dy - best_dy) > WIN]
    rival = min(outside) if outside else best_d
    sharp = rival / best_d if best_d > 0 else 999.0

    if verbose:
        print('panel %02d -> %02d' % (i, j))
        print('  best dy      : %d px  (of %d)  overlap %d px' % (best_dy, H, best_ov))
        print('  match error  : %.2f   (best rival >%dpx away: %.2f -> %.1fx sharper)'
              % (best_d, WIN, rival, sharp))
        if best_dy >= H - 2:
            print('  VERDICT      : no overlap — separate screens, roll a full H')
        elif sharp >= 1.8 and best_d < 20:
            print('  VERDICT      : OVERLAP. roll %d px, not %d — %d px of scene is shared'
                  % (best_dy, H, best_ov))
        else:
            print('  VERDICT      : no real registration — treat as a cut / full roll')
        print()
    return best_dy, best_d, sharp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pairs', nargs='*', default=['3,4', '6,7'])
    ap.add_argument('--all', action='store_true', help='every consecutive pair')
    args = ap.parse_args()

    pairs = [(i, i + 1) for i in range(1, 12)] if args.all \
        else [tuple(int(x) for x in p.split(',')) for p in args.pairs]

    res = {}
    for i, j in pairs:
        res[(i, j)] = analyse(i, j)

    print('--- paste into config.js (0-based panel index -> roll distance in px) ---')
    print('  introRollPx: {')
    for (i, j), (dy, err, sharp) in res.items():
        if dy < 718 and sharp >= 1.8 and err < 20:
            print('    %d: %d,   // boards %d->%d share %d px of scene'
                  % (j - 1, dy, i, j, 720 - dy))
    print('  },')


if __name__ == '__main__':
    main()
