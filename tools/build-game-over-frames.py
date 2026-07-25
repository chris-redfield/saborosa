#!/usr/bin/env python3
"""
build-game-over-frames.py — shrink the flying-dungeon GAME OVER frames to webp.

Same story as the intro storyboard (build-intro-frames.py): the masters are
~5MB RGBA PNGs on a 3784x3800 canvas, but the PICTURE is a tight band floating
in transparency, and all three frames share the EXACT same alpha bbox
(337,1510 -> 3339,3197 = 3002x1687, i.e. 16:9 — the same box the intro uses).
So the crop is safe: the three frames stay pixel-aligned with each other.

Differences from the intro script:
  * resolution is KEPT by default (the band's native 3002x1687). Pass
    --width/--height if you ever want it baked down to the game canvas.
  * the band interior is fully opaque (measured: 0% alpha==0, only antialiased
    edge pixels below 255), so it saves as RGB — nothing shows through a
    full-screen game over panel.

Usage:  python3 tools/build-game-over-frames.py [--quality 82] [--width N --height N]
In:     assets-v2/flying-dungeon/game-over/saborosa-natureza-vermes-NNN.png
Out:    assets-v2/flying-dungeon/game-over/saborosa-natureza-vermes-NNN.webp
"""
import argparse
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'assets-v2', 'flying-dungeon', 'game-over')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quality', type=int, default=82)
    ap.add_argument('--width', type=int, default=0, help='0 = keep the band native width')
    ap.add_argument('--height', type=int, default=0, help='0 = keep the band native height')
    ap.add_argument('--keep-alpha', action='store_true',
                    help='save RGBA instead of RGB (the panel is opaque, so normally not needed)')
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(DIR, 'saborosa-natureza-vermes-*.png')))
    if not files:
        sys.exit('no game over masters found in %s' % DIR)

    box = None
    total_in = total_out = 0
    for f in files:
        im = Image.open(f)

        # All frames must share one bbox or the animation would jitter between
        # frames once each is cropped to its own content.
        b = im.getchannel('A').getbbox()
        if box is None:
            box = b
        elif b != box:
            sys.exit('%s alpha bbox is %s, expected %s — frames would not stay aligned'
                     % (os.path.basename(f), b, box))

        im = im.crop(box)
        im = im.convert('RGBA' if args.keep_alpha else 'RGB')
        if args.width and args.height:
            im = im.resize((args.width, args.height), Image.LANCZOS)

        out = os.path.splitext(f)[0] + '.webp'
        im.save(out, 'WEBP', quality=args.quality, method=6)

        si, so = os.path.getsize(f), os.path.getsize(out)
        total_in += si
        total_out += so
        print('%-36s %s  %6.1fMB -> %5.0fKB' % (os.path.basename(out), im.size, si / 1e6, so / 1e3))

    print('\n%d frames: %.1fMB -> %.2fMB (%.1f%% of original)  crop %s'
          % (len(files), total_in / 1e6, total_out / 1e6, 100 * total_out / total_in, box))


if __name__ == '__main__':
    main()
