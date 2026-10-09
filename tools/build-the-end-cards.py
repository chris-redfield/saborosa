#!/usr/bin/env python3
"""Crop and downscale the two THE END cards for display.

WHAT THEY ARE. Two hand-drawn cards, delivered 2026-10-09 as
`batidao-the end-001.png` and `-002.png`, both 7016x5096 with a star border:

  001  TIME SABOROSA 2026 -- beers raised. The GOOD ending, shown when the
       player cleared BOTH time attacks (COMPLETO) as well as finishing the game.
  002  FIM on a clapperboard, the cast on puppet strings. The lesser ending.

⚠️⚠️ WHY THIS TOOL EXISTS AT ALL: A 7016x5096 RGBA TEXTURE IS 143MB. The game
draws these at about 1040x720 -- they are height-limited by a 16:9 frame and a
card that is 1.45:1 -- so shipping the masters would hand a 256-512MB card two
textures it can never use a tenth of, on a project whose perf history is exactly
that kind of thrash. `how: 'big'` in the manifest would cap them at
`bigTextureCap` 3200 and still leave 30MB each.

⚠️ AND THE MASTERS ARE NOT TOUCHED. Same bargain every cutter here strikes: the
artist's file is the master, this writes the thing the game loads. Re-export the
master and re-run; nothing else changes.

WHAT IT DOES, per card:
  * CROP TO THE ALPHA BBOX. Both pages are drawn on a transparent sheet with the
    card somewhere in the middle -- 22.6% and 19.9% of the pixels are fully
    transparent, and the margins are not equal (001's card starts 109px from the
    left and 414px from the top; 002's 292 and 156). ⚠️ UNCROPPED, THE GAME
    WOULD CENTRE THE PAGE AND NOT THE CARD, so the two endings would sit in
    visibly different places on screen for no reason the player can see.
  * DOWNSCALE so the long edge is `--cap` (default 1600, which is ~1.5x the
    widest the card is ever drawn -- enough that no screen scale softens it).
  * KEEP RGBA. The star border is drawn to an irregular edge and the corners are
    transparent; flattening onto white would put a white rectangle over the
    ending photograph the card sits on.

  python3 tools/build-the-end-cards.py --dry-run
  python3 tools/build-the-end-cards.py
"""
import argparse, os, sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'assets-v2/beatemup-dungeon')

# master -> what the game loads
CARDS = [
    ('batidao-the end-001.png', 'batidao-the-end-1.png'),
    ('batidao-the end-002.png', 'batidao-the-end-2.png'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cap', type=int, default=1600,
                    help='longest edge of the output, in px')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    for src_name, out_name in CARDS:
        src = os.path.join(ART, src_name)
        if not os.path.exists(src):
            sys.exit('missing master: %s' % src)
        im = Image.open(src).convert('RGBA')
        arr = np.array(im)
        ink = arr[..., 3] > 16
        if not ink.any():
            sys.exit('%s is entirely transparent' % src_name)
        ys, xs = np.where(ink.any(1))[0], np.where(ink.any(0))[0]
        box = (int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1)
        card = im.crop(box)
        s = min(1.0, a.cap / max(card.width, card.height))
        if s < 1:
            card = card.resize((max(1, round(card.width * s)),
                                max(1, round(card.height * s))), Image.LANCZOS)
        print('%-26s %dx%d -> crop %dx%d -> %dx%d  (aspect %.3f)'
              % (src_name, im.width, im.height, box[2] - box[0], box[3] - box[1],
                 card.width, card.height, card.width / card.height))
        if a.dry_run:
            continue
        out = os.path.join(ART, out_name)
        card.save(out)
        print('    wrote %s  (%d KB, from %d KB)'
              % (out_name, os.path.getsize(out) // 1024, os.path.getsize(src) // 1024))


main()
