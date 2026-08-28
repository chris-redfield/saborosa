#!/usr/bin/env python3
"""Measure the bookshelf shot's PATH and re-encode it as the fourth room's plate.

⚠️ THIS SHOT IS NOT A PAN, IT IS A SWITCHBACK, and that is the one thing that
makes it unlike the other three plates. The street, the desert and the boss room
all travel in one direction, so `worldPxPerSecond` -- one number -- is enough to
tie the film to the world. This one climbs a bookcase:

    t  0.0 - 18.9s   pan RIGHT  +2338 src px   shelf 1
    t 18.9 - 33.1s   rise       -3288 src px   the first vertical
    t 33.1 - 47.5s   pan LEFT   -3660 src px   shelf 2   <- the awkward one
    t 47.5 - 55.5s   rise       -1730 src px   the second vertical
    t 55.5 - 74.0s   pan RIGHT  +2252 src px   shelf 3

Measured here by phase correlation on BOTH axes (the other tools only ever
needed x). A single camX -> film-time ratio cannot express that, so the room
carries a `path` instead -- a piecewise camX -> seconds map; see
CONFIG.SOURCES.level3Plate and backdrop.js `_filmTime`.

⚠️ THE MASTER IS NOT IN THE REPO, exactly like the desert's. Pass it as argv[1];
it defaults to a sibling `-original` name. The output OVERWRITES the plate, which
was asked for ("ok to replace the video with its own name, I have a copy"). It
is the master that must be kept somewhere, not the plate.

THE SIZE. Asked for the same treatment the desert got. ⚠️ BUT THIS MASTER IS NOT
A MASTER: it arrived already at 848x478 h264 at 1.47 Mbps -- the desert's tool
started from 1920x1080 HEVC at 17.7 Mbps. So the two big levers there are already
spent, and what is left is:

  * ⚠️ THE AUDIO. 256 kbps of AAC on a silent backdrop -- 2.4 MB, 15% of the
    file, for a track nothing ever plays. `-an`. Free, and it is the first thing
    to check on any clip that came off a phone.
  * CRF. Measured against the master at the 1280x720 the player actually sees:

        848x478, GOP 12, preset slow, -an
          crf 26   8.24 MB   SSIM 0.976
          crf 28   6.40 MB   0.972
          crf 30   5.03 MB   0.968     <- chosen
          crf 32   4.01 MB   0.962
          crf 34   3.23 MB   0.954

⚠️ THESE SSIM NUMBERS ARE NOT COMPARABLE TO THE DESERT TOOL'S, and reading them
as "much better than the desert's 0.867" would be wrong twice over. They are
measured against an ALREADY-COMPRESSED source, so they score how faithfully a
second encode reproduces a first one; the desert's were against a clean 1080p
master. High here means "lost little MORE", not "high quality".

⚠️ AND DO NOT RESCALE THIS ONE. The desert tool's finding -- dropping resolution
is worse than raising CRF at equal size -- applies even harder to a file already
at 848x478: there is no oversampling left to spend.

⚠️ GOP 12 FOR THE SAME REASON AS THE OTHER TWO: the room reverses, no browser
implements a negative playbackRate, so going back is a SEEK and a seek decodes
from the previous keyframe. A backward step costs at most twelve frames.

Output (assets-v2/beatemup-dungeon/):
  level-3-plate.mp4   848x478, keyframe every 12 frames, no audio, same duration
"""
import os
import subprocess
import sys

import numpy as np

OUT = 'assets-v2/beatemup-dungeon/level-3-plate.mp4'
DEFAULT_SRC = 'assets-v2/beatemup-dungeon/level-3-plate-original.mp4'
W, H = 848, 478       # what the master already is; do NOT scale further
CANVAS_W = 1280       # CONFIG.GAME_W
CANVAS_H = 720        # CONFIG.GAME_H
KEYINT = 12           # keyframe every N frames -- the reverse-scrub budget
CRF = 30              # see the ladder above before moving it
PRESET = 'slow'
DURATION_TOL = 0.05   # seconds
MEAS_W, MEAS_H = 424, 239   # half size for the correlation; offsets doubled back

# ⚠️ NOT WHICHEVER ffmpeg IS FIRST ON PATH -- a conda build shadows the system
# one in this project's shells and lacks the encoders wanted here.
FFMPEG = '/usr/bin/ffmpeg' if os.path.exists('/usr/bin/ffmpeg') else 'ffmpeg'
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


def motion(src):
    """Cumulative (x, y) offset of the shot, in SOURCE px, per frame.

    Piped as raw gray rather than written out as PNGs: this clip is 2219 frames
    and the desert tool's temp-directory approach would put ~900 MB on disk to
    read it straight back.
    """
    p = subprocess.run(
        [FFMPEG, '-v', 'error', '-i', src,
         '-vf', f'scale={MEAS_W}:{MEAS_H},format=gray', '-f', 'rawvideo', '-'],
        capture_output=True, check=True)
    buf = np.frombuffer(p.stdout, dtype=np.uint8)
    n = len(buf) // (MEAS_W * MEAS_H)
    if n < 2:
        raise SystemExit('no frames decoded -- is the master readable?')
    fr = buf[:n * MEAS_W * MEAS_H].reshape(n, MEAS_H, MEAS_W).astype(float)
    dx = np.zeros(n)
    dy = np.zeros(n)
    prev = np.fft.fft2(fr[0])
    for i in range(1, n):
        cur = np.fft.fft2(fr[i])
        r = prev * np.conj(cur)
        r /= np.abs(r) + 1e-9
        c = np.fft.ifft2(r).real
        iy, ix = np.unravel_index(np.argmax(c), c.shape)
        if ix > MEAS_W // 2:
            ix -= MEAS_W
        if iy > MEAS_H // 2:
            iy -= MEAS_H
        dx[i], dy[i] = ix * 2, iy * 2
        prev = cur
    return np.cumsum(dx), np.cumsum(dy), n


def legs(cx, cy, n, dur):
    """Split the shot into runs that are mostly-horizontal or mostly-vertical.

    ⚠️ SEGMENTED ON WHICH AXIS IS MOVING, NOT ON A FIXED FRAME LIST. The five
    legs are a property of the footage; hard-coding their boundaries would go
    stale the moment the clip is re-cut by a frame.
    """
    fps = n / dur
    win = int(fps)                        # judge on a second of movement
    vert = np.zeros(n, dtype=bool)
    for i in range(n):
        a, b = max(0, i - win // 2), min(n, i + win // 2 + 1)
        vert[i] = abs(cy[b - 1] - cy[a]) > abs(cx[b - 1] - cx[a])
    out, start = [], 0
    for i in range(1, n):
        if vert[i] != vert[i - 1]:
            if i - start > fps:           # ignore sub-second flickers
                out.append((start, i - 1, vert[i - 1]))
                start = i
    out.append((start, n - 1, vert[n - 1]))

    # ⚠️ MERGE NEIGHBOURS ON THE SAME AXIS. Skipping a sub-second flicker above
    # suppresses the APPEND but still leaves a boundary behind it, so a single
    # rise came out as three legs the first time this ran. The `path` wants the
    # five real legs of the shot, not nine that happen to include the noise.
    merged = []
    for leg in out:
        if merged and merged[-1][2] == leg[2]:
            merged[-1] = (merged[-1][0], leg[1], leg[2])
        else:
            merged.append(leg)
    return merged, fps


def main():
    # `--measure` re-reads the shot and prints the legs without re-encoding --
    # the encode is the slow half and the legs are what get iterated on.
    argv = [a for a in sys.argv[1:] if a != '--measure']
    measure_only = '--measure' in sys.argv
    src = argv[0] if argv else DEFAULT_SRC
    if not os.path.exists(src):
        raise SystemExit(f'missing master: {src}\n'
                         f'  pass it as argv[1]; it is deliberately not in the repo')
    want = duration(src)
    cx, cy, n = motion(src)
    L, fps = legs(cx, cy, n, want)

    print(f'{n} frames, {want:.3f}s, {fps:.3f} fps')
    print(f'  total  x {cx[-1]:+.0f}  y {cy[-1]:+.0f} src px'
          f'   x range {cx.min():+.0f}..{cx.max():+.0f}'
          f'   y range {cy.min():+.0f}..{cy.max():+.0f}')
    print('\nLEGS -- what the room\'s `path` has to be built from:')
    print('  #  frames        t (s)          axis      src px   screen px')
    for i, (a, b, v) in enumerate(L):
        d = (cy[b] - cy[a]) if v else (cx[b] - cx[a])
        scale = CANVAS_H / H if v else CANVAS_W / W
        print(f'  {i}  {a:4d}-{b:4d}  {a / fps:5.2f}-{b / fps:5.2f}  '
              f'{"VERTICAL" if v else "horizontal"}  {d:+8.0f}  {d * scale:+9.0f}')

    if measure_only:
        return

    subprocess.run(
        [FFMPEG, '-v', 'error', '-i', src,
         # ⚠️ THE AUDIO IS 15% OF THIS FILE AND NOTHING PLAYS IT.
         '-an',
         # ⚠️ NO `scale` FILTER. The master is already 848x478; see the header.
         '-c:v', 'libx264', '-crf', str(CRF), '-preset', PRESET,
         # ⚠️ `-sc_threshold 0` MATTERS: left on, x264 also places keyframes on
         # scene cuts, and the guarantee this file exists to make is a CEILING
         # on how far a backward seek has to decode.
         '-g', str(KEYINT), '-keyint_min', str(KEYINT), '-sc_threshold', '0',
         '-pix_fmt', 'yuv420p', OUT, '-y'], check=True)

    got = duration(OUT)
    if abs(got - want) > DURATION_TOL:
        raise SystemExit(f'duration changed: {want:.3f} -> {got:.3f}; every knot '
                         'in the room\'s `path` is measured against it')
    mb = os.path.getsize(OUT) / 1048576
    src_mb = os.path.getsize(src) / 1048576
    print(f'\n{OUT}  {got:.3f}s at {W}x{H}, crf {CRF}, keyframe every {KEYINT} '
          f'({keyframes(OUT)} of them), {mb:.2f} MB')
    print(f'  master was {src_mb:.2f} MB  ({src_mb / mb:.1f}x)')


if __name__ == '__main__':
    main()
