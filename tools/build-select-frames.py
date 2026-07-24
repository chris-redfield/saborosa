#!/usr/bin/env python3
"""
build-select-frames.py — bring the main game's SELECT FRUIT art into the
flying-dungeon asset set, as webp.

The flying dungeon reuses the same board the main game uses (src/screens/
select.js): a 3-frame idle loop that exists twice over, pixel-aligned —
a GRAY line-art base (frames 04-06, the "-low" variants) and a COLORED twin
(frames 01-03). The screen draws gray everywhere and the colored twin clipped
to the panel under the cursor, so only the highlighted fruit lights up while the
whole board keeps moving.

The dungeon ships standalone from assets-v2/flying-dungeon/, so it can't reach
into the main game's assets/ folder — these get copied in and compressed.
Alpha is preserved: the board is a cut-out that sits over the intro panel.

Usage:  python3 tools/build-select-frames.py [--quality 90]
Output: assets-v2/flying-dungeon/select/saborosa-select-{gray,color}-N.webp
"""
import argparse
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets')
DST = os.path.join(ROOT, 'assets-v2', 'flying-dungeon', 'select')

# (output name, source file) — the gray base uses the "-low" variants, which is
# what the main game loads.
PAIRS = [
    ('gray-1',  'fruit-select-04-low.png'),
    ('gray-2',  'fruit-select-05-low.png'),
    ('gray-3',  'fruit-select-06-low.png'),
    ('color-1', 'fruit-select-01.png'),
    ('color-2', 'fruit-select-02.png'),
    ('color-3', 'fruit-select-03.png'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quality', type=int, default=90)
    args = ap.parse_args()

    os.makedirs(DST, exist_ok=True)
    total_in = total_out = 0
    size = None

    for name, src in PAIRS:
        p = os.path.join(SRC, src)
        im = Image.open(p).convert('RGBA')      # keep alpha: it overlays the intro panel

        # Every frame must share one canvas or the two loops stop being aligned
        # and the colour twin would drift inside the clip rect.
        if size is None:
            size = im.size
        elif im.size != size:
            raise SystemExit('%s is %s, expected %s — frames must stay aligned'
                             % (src, im.size, size))

        out = os.path.join(DST, 'saborosa-select-%s.webp' % name)
        im.save(out, 'WEBP', quality=args.quality, method=6)

        si, so = os.path.getsize(p), os.path.getsize(out)
        total_in += si
        total_out += so
        print('%-34s %s  %5.0fKB -> %5.0fKB' % (os.path.basename(out), im.size, si / 1e3, so / 1e3))

    print('\n%d frames: %.0fKB -> %.0fKB (%.0f%%)  canvas %s'
          % (len(PAIRS), total_in / 1e3, total_out / 1e3, 100 * total_out / total_in, size))


if __name__ == '__main__':
    main()
