#!/usr/bin/env python3
"""Measure the desert shot's pan and re-encode it as the third room's plate.

The desert level is the beat 'em up's second walking room, and it is built the
same way the street is: the mp4 IS the backdrop, drawn stationary filling the
canvas and scrubbed by camera position (see CONFIG.SOURCES in
beatemup-dungeon/src/config.js). Two things have to be true of the file before
that works, and this tool does both.

1. THE PAN HAS TO BE MEASURED, not guessed. `worldPxPerSecond` is how many px of
   CAMERA travel one second of the shot's own pan is worth -- get it wrong and
   the background either races the player or leaves them sliding across a still.
   Per-frame horizontal offset by phase correlation, summed over the whole clip,
   exactly as tools/build-boss-plate.py finds the boss room's turn.

   Measured on the current file: 3317px of pan across 780 CFR frames of a
   848-wide picture. Drawn to a 1280-wide canvas that is 3317 * 1280/848 = 5007
   screen px in 26.026s = 192.4 px/s -- a shot that pans about 1.7x faster than
   the street's 116.

2. IT HAS TO BE SCRUBBABLE BACKWARDS, because the room has `reverse: true` like
   the street. No browser implements a negative playbackRate, so going back is a
   SEEK, and a seek decodes from the previous keyframe. GOP 12 is the point
   tools/build-street-plate.py settled on and this uses the same: a backward step
   costs at most twelve frames of an 848x478 picture.

AND IT IS DOWNSCALED, which the other two plates did not need. The master is
1920x1080 HEVC at 17.7 Mbps -- 56MB, against a whole itch build of 30. The plate
is stretched to the 1280x720 canvas whatever its own size, so 848x478 (what both
existing plates already are) costs nothing visible.

3. IT HAS TO BE SMALL. Asked for 2026-08-27 -- "drastically reduce the video
   size, in order to use it in our game". The first cut of this plate was
   `-b:v 3000k` (the street tool's setting) and came out at 9.9MB. CRF 32 puts
   it at 4.8MB, and the whole ladder was measured rather than picked:

   ⚠️ SSIM HERE IS AGAINST THE MASTER AT THE 1280x720 THE PLAYER ACTUALLY SEES,
   not at the encode's own size -- comparing plates at their native resolution
   would flatter a small one for free. It is also PESSIMISTIC on this shot: the
   picture is a field of gravel, which is the texture SSIM punishes hardest, and
   the chroma planes score 0.98 throughout. Read the ordering, not the value.

       848x478, GOP 12, preset slow
         b:v 3000k   9.9 MB   0.904     <- what this tool shipped first
         crf 28      7.9 MB   0.897
         crf 30      6.1 MB   0.884
         crf 32      4.8 MB   0.867     <- chosen
         crf 34      3.8 MB   0.845

   THREE OTHER LEVERS WERE TRIED AND ALL THREE ARE DEAD ENDS. They are recorded
   because each one is the obvious next idea:

     * ⚠️ DROPPING THE RESOLUTION IS WORSE THAN RAISING CRF, AT THE SAME FILE
       SIZE. 640x360 crf 26 is 6.1MB and scores 0.831, against 0.884 for 848x478
       crf 30 at 6.1MB; 512x288 crf 28 is 3.0MB / 0.749 against 3.8MB / 0.845 at
       native. It is visible too -- the small ones go mushy on the gravel while
       the high-CRF ones only lose grain. Do not "save space" by scaling further.
     * ⚠️ VP9 IS TWICE THE SIZE, NOT HALF. 19.2MB at crf 34 and 13.9MB at crf 38,
       against 10.2MB for x264 crf 26. The reason is the GOP: libvpx spends far
       more on a keyframe than x264 does, and this file is forced to carry 65 of
       them. VP9's usual advantage assumes long GOPs, which is exactly what a
       scrubbable plate cannot have.
     * ⚠️ DENOISING FIRST SAVES NOTHING. `hqdn3d=4:3:6:4` before the scale came
       out at 10.18MB against 10.22MB clean, and a heavy 8:6:12:9 only reached
       7.60MB against 7.86MB. The bits are going into real gravel, not into
       sensor noise, so there is nothing to take out.

   AND THE GOP IS NOT WHERE THE SIZE IS EITHER: 12 -> 48 at crf 26 saves 2.7MB
   and makes every backward step decode four times as far. Not a trade worth
   making for a room whose camera reverses.

⚠️ THE ASSERTION HERE IS THE DURATION, NOT THE FRAME COUNT, and that is the one
deliberate difference from the street's tool. The master is variable-rate
(r_frame_rate 29.917, avg 30.046) so ffprobe counts 782 frames where a constant
-rate decode yields 780; asserting the count would fail on a file that is
perfectly fine. `worldPxPerSecond` is measured per SECOND, so the duration is
what must not move -- a re-timed clip desyncs the background from the world
standing in front of it.

Output (assets-v2/beatemup-dungeon/):
  desert-plate.mp4    848x478, keyframe every 12 frames, same duration
"""
import glob
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image

SRC = 'assets-v2/beatemup-dungeon/background-desert-level.mp4'
OUT = 'assets-v2/beatemup-dungeon/desert-plate.mp4'
W, H = 848, 478       # what both existing plates are; the canvas stretches it anyway
CANVAS_W = 1280       # CONFIG.GAME_W -- the width the pan is finally seen at
KEYINT = 12           # keyframe every N frames -- the reverse-scrub budget
CRF = 32              # the size knob; see the ladder above before moving it
PRESET = 'slow'       # costs encode time only, and buys ~5% of file size
DURATION_TOL = 0.05   # seconds

# ⚠️ NOT WHICHEVER ffmpeg IS FIRST ON PATH. A conda ffmpeg shadows the system one
# in this project's shells and is built without the encoders wanted here; the
# same trap cost an afternoon on the sound pipeline. Prefer /usr/bin.
FFMPEG  = '/usr/bin/ffmpeg' if os.path.exists('/usr/bin/ffmpeg') else 'ffmpeg'
FFPROBE = '/usr/bin/ffprobe' if os.path.exists('/usr/bin/ffprobe') else 'ffprobe'


def duration(path):
    out = subprocess.run(
        [FFPROBE, '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', path], capture_output=True, text=True,
        check=True).stdout.strip()
    return float(out)


def keyframes(path):
    out = subprocess.run(
        [FFPROBE, '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'frame=key_frame', '-of', 'csv=p=0', path],
        capture_output=True, text=True, check=True).stdout
    return sum(1 for line in out.splitlines() if line.startswith('1'))


def pan(tmp):
    """Total rightward pan of the shot, in source px, by phase correlation."""
    subprocess.run([FFMPEG, '-v', 'error', '-i', SRC, '-vf', f'scale={W}:{H}',
                    os.path.join(tmp, 'f%04d.png'), '-y'], check=True)
    files = sorted(glob.glob(os.path.join(tmp, 'f*.png')))
    if not files:
        raise SystemExit('no frames extracted -- is ffmpeg on PATH?')

    def gray(p):
        return np.array(Image.open(p).convert('L'), dtype=float)

    prev, cum, off = gray(files[0]), 0.0, [0.0]
    for p in files[1:]:
        cur = gray(p)
        a, b = np.fft.fft2(prev), np.fft.fft2(cur)
        r = a * np.conj(b)
        r /= np.abs(r) + 1e-9
        c = np.fft.ifft2(r).real
        _, ix = np.unravel_index(np.argmax(c), c.shape)
        if ix > c.shape[1] // 2:
            ix -= c.shape[1]
        cum += ix
        off.append(cum)
        prev = cur
    return np.array(off)


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f'missing {SRC}')
    want = duration(SRC)

    with tempfile.TemporaryDirectory() as tmp:
        off = pan(tmp)

    total = off[-1]
    peak = int(np.argmax(off))
    screen = total * CANVAS_W / W
    pps = screen / want

    print(f'pan: {total:.0f} src px over {len(off)} frames, '
          f'peak at frame {peak} of {len(off) - 1}')
    if peak < len(off) - 1:
        # A shot that turns around cannot be played whole -- see build-boss-plate.
        print(f'  ⚠️ the pan PEAKS before the end ({off[peak]:.0f} at {peak}, '
              f'{total:.0f} at the end). If it comes back, crop it at the turn.')
    print(f'  at the {CANVAS_W}px canvas: {screen:.0f} screen px in {want:.3f}s')
    print(f'  worldPxPerSecond for this plate: {pps:.1f}')

    subprocess.run(
        [FFMPEG, '-v', 'error', '-i', SRC, '-an', '-vf', f'scale={W}:{H}',
         # ⚠️ CRF, NOT A BITRATE. A fixed bitrate spends the same on the whole
         # shot; this picture is uniformly detailed but its DETAIL varies with
         # what the camera is over, and constant quality is what keeps the
         # gravel from breaking up on the busy stretches.
         '-c:v', 'libx264', '-crf', str(CRF), '-preset', PRESET,
         # ⚠️ `-sc_threshold 0` MATTERS. Left on, x264 also places keyframes on
         # scene cuts, which on filmed footage means the spacing is whatever the
         # shot happens to do -- and the guarantee this file exists to make is a
         # CEILING on how far a backward seek has to decode.
         '-g', str(KEYINT), '-keyint_min', str(KEYINT), '-sc_threshold', '0',
         '-pix_fmt', 'yuv420p', OUT, '-y'], check=True)

    got = duration(OUT)
    if abs(got - want) > DURATION_TOL:
        raise SystemExit(f'duration changed: {want:.3f} -> {got:.3f}; the plate '
                         'sync (worldPxPerSecond) is measured against it')
    mb = os.path.getsize(OUT) / 1048576
    print(f'{OUT}  {got:.3f}s at {W}x{H}, crf {CRF}, keyframe every {KEYINT} '
          f'({keyframes(OUT)} of them), {mb:.2f} MB')
    print(f'  master was {os.path.getsize(SRC) / 1048576:.2f} MB '
          f'({os.path.getsize(SRC) / 1048576 / mb:.0f}x)')


if __name__ == '__main__':
    main()
