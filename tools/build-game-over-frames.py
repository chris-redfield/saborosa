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

Masters get redrawn, and the redraws arrive with a version suffix
(saborosa-natureza-vermes-001-V2.png). So the script groups the masters by their
NNN index and builds the HIGHEST version of each, printing which file won —
the output name always drops the suffix, so the game keeps loading
saborosa-natureza-vermes-NNN.webp no matter which revision is current.

Usage:  python3 tools/build-game-over-frames.py [--quality 82] [--width N --height N]
In:     assets-v2/flying-dungeon/originals/saborosa-natureza-vermes-NNN[-VN].png
        (falls back to the game-over/ folder if no masters sit in originals/)
Out:    assets-v2/flying-dungeon/game-over/saborosa-natureza-vermes-NNN.webp
"""
import argparse
import glob
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FD = os.path.join(ROOT, 'assets-v2', 'flying-dungeon')
SRC = os.path.join(FD, 'originals')
DST = os.path.join(FD, 'game-over')
GLOB = 'saborosa-natureza-vermes-*.png'
# saborosa-natureza-vermes-001-V2.png -> index '001', version 2
NAME_RE = re.compile(r'^(saborosa-natureza-vermes-(\d+))(?:-[Vv](\d+))?$')


def pick_masters(src):
    """Newest revision of each frame index, as [(index, path, version), ...]."""
    best = {}
    for p in sorted(glob.glob(os.path.join(src, GLOB))):
        m = NAME_RE.match(os.path.splitext(os.path.basename(p))[0])
        if not m:
            print('skipping unrecognised name: %s' % os.path.basename(p))
            continue
        stem, idx, ver = m.group(1), m.group(2), int(m.group(3) or 1)
        if idx not in best or ver > best[idx][2]:
            best[idx] = (stem, p, ver)
    return [(idx,) + best[idx][1:] for idx in sorted(best)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quality', type=int, default=82)
    ap.add_argument('--width', type=int, default=0, help='0 = keep the band native width')
    ap.add_argument('--height', type=int, default=0, help='0 = keep the band native height')
    ap.add_argument('--keep-alpha', action='store_true',
                    help='save RGBA instead of RGB (the panel is opaque, so normally not needed)')
    ap.add_argument('--src', default=None, help='override the master folder')
    args = ap.parse_args()

    picked = pick_masters(args.src or SRC)
    if not picked and not args.src:
        picked = pick_masters(DST)                  # masters used to live next to the output
    if not picked:
        sys.exit('no game over masters found in %s' % (args.src or SRC))

    for idx, p, ver in picked:
        print('frame %s <- %-40s (V%d)' % (idx, os.path.basename(p), ver))
    print()

    box = None
    total_in = total_out = 0
    for idx, f, _ver in picked:
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

        # Version suffix dropped: the game always loads ...-NNN.webp.
        out = os.path.join(DST, 'saborosa-natureza-vermes-%s.webp' % idx)
        im.save(out, 'WEBP', quality=args.quality, method=6)

        si, so = os.path.getsize(f), os.path.getsize(out)
        total_in += si
        total_out += so
        print('%-36s %s  %6.1fMB -> %5.0fKB' % (os.path.basename(out), im.size, si / 1e6, so / 1e3))

    print('\n%d frames: %.1fMB -> %.2fMB (%.1f%% of original)  crop %s'
          % (len(picked), total_in / 1e6, total_out / 1e6, 100 * total_out / total_in, box))


if __name__ == '__main__':
    main()
