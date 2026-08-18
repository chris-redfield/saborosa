#!/usr/bin/env python3
"""Crop the boss-room shot at the moment its camera turns around, and re-encode
it so it can be scrubbed BACKWARDS.

TWO PROBLEMS WITH THE SOURCE, and this tool exists for both.

1. THE SHOT GOES OUT AND COMES BACK. It pans right for about five seconds,
   rests, then returns to where it started. Played as a plate that would walk
   the player forward into the room and then drag the room back past them. Only
   the outward half is wanted, so the turn has to be FOUND rather than guessed:
   per-frame horizontal offset by phase correlation, and the cut goes at the
   peak. Measured on the current file that is frame 156, t=5.206s, after 224px
   of travel -- and then it sits still for twelve frames before retreating,
   which is the giveaway that the peak is a real stop and not noise.

   The cut is at the PEAK, not at the end of that plateau. A plateau left in
   would be camera travel that shows no movement -- the room would feel stuck
   against its own right-hand wall.

2. THE BOSS ROOM'S CAMERA GOES BOTH WAYS, and video cannot play backwards. No
   browser implements a negative playbackRate, so reverse means SEEKING, and a
   seek costs a decode from the previous keyframe. The source has two keyframes
   in eleven seconds; a step backwards would decode hundreds of frames.

   So it is re-encoded with a keyframe every third frame. A backward step then
   decodes at most three frames, which is fast enough to scrub. All-intra (one
   keyframe per frame) was measured too and costs 8.7MB against 3.0MB for a
   difference nobody can see at this size.

This does NOT apply to the main level's plate: that camera only ever goes
forward, so its shot is left alone at its original eight megabytes.

Output (assets-v2/beatemup-dungeon/):
  boss-room-plate.mp4    cropped at the turn, keyframe every 3 frames
"""
import glob
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image

SRC = 'assets-v2/beatemup-dungeon/batida-de-coco-background-boss-original.mp4'
OUT = 'assets-v2/beatemup-dungeon/boss-room-plate.mp4'
W, H = 848, 478
KEYINT = 3            # keyframe every N frames -- the reverse-scrub budget
BITRATE = '2800k'


def probe_fps_and_frames():
    def q(entry):
        return subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
             '-show_entries', entry, '-of', 'default=noprint_wrappers=1:nokey=1',
             SRC], capture_output=True, text=True, check=True).stdout.strip()
    return float(q('stream=nb_frames')), float(q('format=duration'))


def turn_point(tmp):
    """Frame index at which the pan stops going right, by phase correlation."""
    subprocess.run(['ffmpeg', '-v', 'error', '-i', SRC, '-vf', f'scale={W}:{H}',
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
        iy, ix = np.unravel_index(np.argmax(c), c.shape)
        if ix > c.shape[1] // 2:
            ix -= c.shape[1]
        cum += ix
        off.append(cum)
        prev = cur
    off = np.array(off)
    return int(np.argmax(off)), off


def main():
    nframes, duration = probe_fps_and_frames()
    fps = nframes / duration

    with tempfile.TemporaryDirectory() as tmp:
        peak, off = turn_point(tmp)

    t = peak / fps
    hold = int((off[peak:] >= off[peak] - 1).argmin()) if peak < len(off) else 0
    print(f'turn found at frame {peak}, t={t:.3f}s, after {off[peak]:.0f}px of pan')
    print(f'  it then holds for {hold} frames before retreating')
    print(f'  pan at 720-tall display: {off[peak] * 720 / H:.0f} screen px')

    subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', SRC, '-t', f'{t:.3f}', '-an',
         '-c:v', 'libopenh264', '-b:v', BITRATE,
         '-g', str(KEYINT), '-pix_fmt', 'yuv420p', OUT, '-y'], check=True)

    mb = os.path.getsize(OUT) / 1048576
    print(f'{OUT}  {t:.3f}s, keyframe every {KEYINT} frames, {mb:.2f} MB')
    print(f'  worldPxPerSecond for this plate: {off[peak] * 720 / H / t:.1f}')


if __name__ == '__main__':
    main()
