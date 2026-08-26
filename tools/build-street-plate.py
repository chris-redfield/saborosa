#!/usr/bin/env python3
"""Re-encode the street plate so the camera can be scrubbed BACKWARDS through it.

WHY THIS EXISTS. The backdrop is the footage itself, indexed by camera position
(see CONFIG.BACKDROP.plate). Going forward is cheap: the video is PLAYED at
whatever rate keeps it level with the camera. Going back is not, because no
browser implements a negative playbackRate -- the only way back is to SEEK, and
a seek decodes forward from the nearest keyframe before it.

THE MASTER CANNOT BE SCRUBBED AND THAT IS A PROPERTY OF THE FILE, NOT A BUG.
`batidao-de-coco-background-original.mp4` carries THREE keyframes across 887
frames -- one roughly every ten seconds -- so a single step backwards can cost
a decode of nearly three hundred frames. That is what made
`CONFIG.ROOMS.street.reverse` false while the boss room's was true: the boss
clip already ships re-encoded (tools/build-boss-plate.py, a keyframe every third
frame), the street's did not.

WHAT IS TRADED. Keyframes are expensive -- they carry a whole picture where a
P-frame carries a difference -- so a dense GOP either grows the file or spends
the same bits on fewer pictures. Measured across the actual shot:

    GOP  bitrate   size     SSIM vs master   worst-case seek
      3     2045k   7.8 MB     0.795          3 frames
      3     crf20  38.5 MB     0.886          3 frames
     12     3000k  11.0 MB     0.872         12 frames
     30     2500k   8.9 MB     0.873         30 frames
    887(master)     8.1 MB     1.000        296 frames

⚠️ SSIM TOPS OUT AROUND 0.886 WHATEVER IS SPENT, because the master is already
a compressed encode -- that number is the re-encode floor, not a quality target
to chase. Past crf20 the size triples for nothing visible.

GOP 12 is the chosen point: a backward step decodes at most twelve frames of an
848x478 picture, which is a few milliseconds, and the file grows by 2.8MB rather
than by 30. Move KEYINT if the trade needs to move -- SIZE is the cost of a
small one and a HITCH on every backward step is the cost of a large one.

⚠️ THE FRAME COUNT AND THE FRAME RATE MUST NOT CHANGE, and the script asserts
the first. `worldPxPerSecond` (116) is a MEASUREMENT of how much of the shot's
pan one second is worth; re-timing the clip silently desyncs the background
from the world it is standing behind.

Output (assets-v2/beatemup-dungeon/):
  street-plate.mp4   same 887 frames, same duration, seekable
"""
import os
import subprocess
import sys

SRC = 'assets-v2/beatemup-dungeon/batidao-de-coco-background-original.mp4'
OUT = 'assets-v2/beatemup-dungeon/street-plate.mp4'
KEYINT  = 12          # keyframe every N frames -- the reverse-scrub budget
BITRATE = '3000k'

# ⚠️ NOT WHICHEVER ffmpeg IS FIRST ON PATH. A conda ffmpeg shadows the system
# one in this project's shells and is built without the encoders wanted here;
# the same trap cost an afternoon on the sound pipeline. Prefer /usr/bin.
FFMPEG  = '/usr/bin/ffmpeg' if os.path.exists('/usr/bin/ffmpeg') else 'ffmpeg'
FFPROBE = '/usr/bin/ffprobe' if os.path.exists('/usr/bin/ffprobe') else 'ffprobe'


def frames(path):
    out = subprocess.run(
        [FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-count_frames',
         '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', path],
        capture_output=True, text=True, check=True).stdout.strip()
    return int(out)


def keyframes(path):
    out = subprocess.run(
        [FFPROBE, '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'frame=key_frame', '-of', 'csv=p=0', path],
        capture_output=True, text=True, check=True).stdout
    return sum(1 for line in out.splitlines() if line.startswith('1'))


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f'missing {SRC}')
    want = frames(SRC)

    subprocess.run(
        [FFMPEG, '-v', 'error', '-i', SRC, '-an',
         '-c:v', 'libx264', '-b:v', BITRATE,
         # ⚠️ `-sc_threshold 0` MATTERS. Left on, x264 also places keyframes on
         # scene cuts, which on filmed footage means the spacing is whatever the
         # shot happens to do -- and the guarantee this file exists to make is a
         # CEILING on how far a backward seek has to decode.
         '-g', str(KEYINT), '-keyint_min', str(KEYINT), '-sc_threshold', '0',
         '-pix_fmt', 'yuv420p', OUT, '-y'], check=True)

    got = frames(OUT)
    if got != want:
        raise SystemExit(f'frame count changed: {want} -> {got}; the plate sync '
                         '(worldPxPerSecond) is measured against the frame count')
    mb = os.path.getsize(OUT) / 1048576
    print(f'{OUT}  {got} frames, keyframe every {KEYINT} '
          f'({keyframes(OUT)} of them), {mb:.2f} MB')
    print(f'  master was {os.path.getsize(SRC) / 1048576:.2f} MB with '
          f'{keyframes(SRC)} keyframes')


if __name__ == '__main__':
    sys.exit(main())
