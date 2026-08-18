#!/usr/bin/env python3
"""Stitch the filmed backdrop into ONE panorama strip for the beat 'em up.

WHY THIS EXISTS INSTEAD OF A FRAME SEQUENCE. The design always assumed the
plate would ship as footage -- `backdrop.js` has a whole `film` source with a
scrub mode and a play mode waiting for it. Then the footage arrived and turned
out to be a pure horizontal DOLLY across a still subject: measured over the
whole shot the camera moves 3px a frame sideways and never more than 2px
vertically, and nothing in the scene moves on its own.

That changes the arithmetic completely:

    as a frame sequence   ~113 frames (the level is 2720 camera px at
                          pxPerFrame 24) x 424x239 = about 46 MB decoded, and
                          that is already the SOFT version -- native res is
                          220 MB
    as one panorama       3114 x 478 = about 6 MB decoded, at full native
                          resolution, with no frame stepping at all

PERFORMANCE.md is the reason that matters: the target is an old card whose
whole texture budget is a few tens of MB, and a frame sequence was flagged from
the start as the most expensive thing this game would ever load. A panorama is
an order of magnitude cheaper AND sharper, and it scrolls continuously rather
than cutting between frames.

WHAT IS LOST is the film source's `play` mode -- the world carrying on around a
locked fight. Nothing is actually lost here, because this shot has no in-frame
motion to carry on with; it is a still life that the camera walks past. If a
later shot has drifting smoke or a crowd, it wants the frame sequence and this
tool does not apply to it.

HOW THE STITCH WORKS. Per-frame horizontal offset by phase correlation, then a
SLIT-SCAN: each frame contributes only the narrow strip it advanced by, taken
from the frame CENTRE where lens distortion is least and there are no edge
compression artefacts. Pasting whole overlapping frames instead would take each
strip from a frame's left edge and stack any exposure difference into a seam.

The cumulative offset is forced monotonic. About 15 frames of the 887 measure a
pixel BACKWARDS, which is camera shake rather than travel; letting the strip
position go backwards would overwrite ground already laid and double an object.

Output (assets-v2/beatemup-dungeon/):
  plate-panorama.webp    the strip, native resolution
"""
import glob
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

SRC   = 'assets-v2/beatemup-dungeon/batidao-de-coco-background-original.mp4'
OUT   = 'assets-v2/beatemup-dungeon/plate-panorama.webp'
W, H  = 848, 478      # native frame size; the strip keeps it
QUALITY = 88          # webp; the plate is photographic, so this is worth paying


def frames(tmp):
    """Every frame of the shot as PNG, at native size."""
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', SRC, '-vf', f'scale={W}:{H}',
         os.path.join(tmp, 'f%04d.png'), '-y'],
        check=True)
    return sorted(glob.glob(os.path.join(tmp, 'f*.png')))


def offsets(files):
    """Cumulative horizontal offset per frame, by phase correlation."""
    def gray(p):
        return np.array(Image.open(p).convert('L'), dtype=float)

    prev, out, cum = gray(files[0]), [0.0], 0.0
    for p in files[1:]:
        cur = gray(p)
        a, b = np.fft.fft2(prev), np.fft.fft2(cur)
        r = a * np.conj(b)
        r /= np.abs(r) + 1e-9
        c = np.fft.ifft2(r).real
        iy, ix = np.unravel_index(np.argmax(c), c.shape)
        if ix > c.shape[1] // 2:
            ix -= c.shape[1]
        cum += ix
        out.append(cum)
        prev = cur
    # Monotonic: see the note on camera shake in the docstring.
    return np.maximum.accumulate(np.array(out))


def main():
    with tempfile.TemporaryDirectory() as tmp:
        files = frames(tmp)
        if not files:
            raise SystemExit('no frames extracted -- is ffmpeg on PATH?')
        off = offsets(files)

        cx = W // 2                       # the slit, taken from the frame centre
        width = int(off[-1]) + W
        pan = np.zeros((H, width, 3), dtype=np.uint8)

        # Everything left of the first slit comes from frame one, so the strip
        # starts with a whole frame rather than a half-painted edge.
        pan[:, :cx] = np.array(Image.open(files[0]).convert('RGB'))[:, :cx]

        for i, p in enumerate(files):
            x0 = int(round(off[i]))
            nxt = int(round(off[i + 1])) if i + 1 < len(off) else x0 + W
            run = max(1, nxt - x0) if i + 1 < len(off) else W - cx
            dst = x0 + cx
            run = min(run, W - cx, width - dst)
            if run <= 0:
                continue
            a = np.array(Image.open(p).convert('RGB'))
            pan[:, dst:dst + run] = a[:, cx:cx + run]

        img = Image.fromarray(pan)
        img.save(OUT, quality=QUALITY, method=6)
        kb = os.path.getsize(OUT) / 1024
        mb = img.width * img.height * 4 / 1e6
        print(f'{OUT}  {img.width}x{img.height}  {kb:.0f} KB on disk, '
              f'{mb:.1f} MB decoded  (from {len(files)} frames, '
              f'pan {off[-1]:.0f}px)')


if __name__ == '__main__':
    main()
