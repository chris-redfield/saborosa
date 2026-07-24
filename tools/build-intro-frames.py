#!/usr/bin/env python3
"""
build-intro-frames.py — shrink the flying-dungeon intro storyboard to webp.

The masters (assets-v2/flying-dungeon/originals/intro/) are ~5.5MB RGBA PNGs on
a 3784x3800 canvas, but the PICTURE is a tight 3002x1687 band floating in
transparency — every frame shares the exact same alpha bounding box. This crops
to that box, resizes to the game's canvas size, and writes webp.

Same trade as the tray frames (which stay native-res and downscale at load,
because the camera pans a world LARGER than the screen): here the camera only
rolls vertically and each panel is drawn 1:1 at full screen, so the display size
is known up front and we can bake it in. 12 x 5.5MB PNG -> ~12 x 90KB webp.

Usage:  python3 tools/build-intro-frames.py [--quality 82] [--width 1280]
Output: assets-v2/flying-dungeon/saborosa-intro-NN.webp
"""
import argparse
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-v2', 'flying-dungeon', 'originals', 'intro')
DST = os.path.join(ROOT, 'assets-v2', 'flying-dungeon')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quality', type=int, default=82)
    # Defaults to the game's internal canvas (CONFIG.GAME_W/GAME_H); the panels
    # are drawn 1:1, so anything larger is pixels nobody ever sees.
    ap.add_argument('--width', type=int, default=1280)
    ap.add_argument('--height', type=int, default=720)
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(SRC, 'saborosa-abre-natureza-*.png')))
    if not files:
        sys.exit('no intro masters found in %s' % SRC)

    total_in = total_out = 0
    for i, f in enumerate(files):
        im = Image.open(f)
        box = im.getchannel('A').getbbox()          # the picture inside the transparency
        im = im.crop(box).convert('RGB')            # opaque: nothing shows through a panel
        im = im.resize((args.width, args.height), Image.LANCZOS)

        out = os.path.join(DST, 'saborosa-intro-%02d.webp' % (i + 1))
        im.save(out, 'WEBP', quality=args.quality, method=6)

        si, so = os.path.getsize(f), os.path.getsize(out)
        total_in += si
        total_out += so
        print('%-34s %s -> %dx%d  %6.1fMB -> %5.0fKB'
              % (os.path.basename(out), box, args.width, args.height, si / 1e6, so / 1e3))

    print('\n%d panels: %.1fMB -> %.2fMB (%.1f%% of original)'
          % (len(files), total_in / 1e6, total_out / 1e6, 100 * total_out / total_in))


if __name__ == '__main__':
    main()
