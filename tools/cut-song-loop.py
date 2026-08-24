#!/usr/bin/env python3
"""
cut-song-loop.py -- take a loop out of a finished song and encode it small.

    assets/MIKE.mp3  (249.9s, 7.4MB)
        |__ cut-song-loop.py --start 105.151 --length 60.107 -->
    assets-v2/beatemup-dungeon/audio/mike-title.ogg  (60.1s, ~0.7MB)

WHY A CUT AND NOT JUST A RE-ENCODE. A four-minute song behind a title screen is
four minutes nobody hears: the player is there for ten seconds and then presses
a button. What that screen wants is a piece of the song that can go round
forever without announcing where it started. Re-encoding alone would have taken
MIKE from 7.4MB to about 2.5MB; cutting first takes it to 0.7MB and makes it a
better title screen at the same time.

⚠️ IT NEVER TOUCHES THE SOURCE. assets/MIKE.mp3 is the MAIN GAME's intro theme
and is still played there in full, looping, by src/main.js. This writes a
separate file under the beat 'em up's own audio folder. Shortening the shared
file would have silently re-cut the main game's intro.

HOW THE CUT POINTS WERE FOUND, and the method is reusable:
  1. Onset flux -> autocorrelation gives the tempo (MIKE: 111.8 BPM, so a
     4/4 bar is 2.1467s). A loop that is not a whole number of BARS cannot
     work, however good the two ends sound on their own.
  2. Comb the flux with a bar-long pulse train to find the PHASE -- where the
     downbeats actually fall. Bar length without phase puts every candidate
     cut in the middle of a bar.
  3. Score every (downbeat start, whole-bar length) pair by how alike the music
     is at S and at S+L, using the cosine similarity of a 24-band log
     spectrogram over a 4s window centred on each. A loop's seam works when the
     music arriving at the end sounds like the music that is about to begin.
MIKE's best 28-bar candidate scored 0.637 at 105.151s; its best 24-bar one
scored 0.670 at 113.737s. 28 bars was taken because 60s was the brief.

⚠️ THE SEAM IS CROSSFADED HERE, AND crop-beat-trilha.py's SUM WOULD NOT WORK.
That was tried first, because it is the same problem: take the material that
CONTINUES past the cut and add it onto the head. It works on the beat 'em up bed
because that bed's head is a downbeat with near-silence in front of it -- adding
a ring to nothing is still the ring. A SONG has no silence anywhere, so the
head's own first sample is full level and summing leaves the step exactly where
it was. Measured: |first - last| came out at 0.0584 against a median neighbour
step of 0.0032, an eighteen-fold jump, which is a click.

So the head is faded IN while the continuation is faded OUT, equal-power, over
`--overhang`:

    out[0:v] = src[S : S+v] * sin(pi/2 t)  +  src[S+L : S+L+v] * cos(pi/2 t)

At t=0 that is exactly src[S+L], which is what follows src[S+L-1] -- the last
sample of the loop -- so the wrap is continuous by construction rather than by
being quiet. By t=1 it is the head proper and nothing else.

⚠️ KEEP THE OVERHANG WELL UNDER A BEAT. It is 120ms here, about a fifth of
MIKE's 536ms beat. Long crossfades smear the downbeat the loop starts on, which
does not click but does make every wrap sound like the drummer flammed.

⚠️ THE LOOP LENGTH MUST BE PINNED IN CONFIG. Opus adds a few ms of padding and
`AudioBufferSourceNode.loop` with no bounds wraps at the decoded length, so an
unpinned loop ticks once a minute. The key goes in `CONFIG.MUSIC_LOOP` under the
track's ASSET key; the script prints the line to paste.

    python3 tools/cut-song-loop.py
    python3 tools/cut-song-loop.py --start 113.737 --length 51.521 --dry-run
    python3 tools/cut-song-loop.py --src assets/beats.mp3 --out-name beats-loop
"""
import argparse
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, 'assets-v2', 'beatemup-dungeon', 'audio')

SR = 48000               # what the rest of this game's audio is
BITRATE = '96k'          # stereo opus; transparent enough for a title bed
# Defaults: MIKE's 28-bar loop out of the fullest part of the track.
SRC = os.path.join(ROOT, 'assets', 'MIKE.mp3')
OUT_NAME = 'mike-title'
START_S = 105.151
LENGTH_S = 60.107
# Equal-power crossfade at the wrap, in ms. See the note above: well under a
# beat (MIKE's is 536ms) or the downbeat smears.
OVERHANG_MS = 120


def decode(path):
    """-> (samples, channels) float64, shape (n, ch)."""
    p = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ar', str(SR), '-f', 'f32le', '-'],
        capture_output=True)
    if p.returncode:
        sys.exit(p.stderr.decode()[:400])
    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=channels',
         '-of', 'default=nw=1:nk=1', path], capture_output=True)
    ch = int(probe.stdout.split()[0])
    x = np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, ch), ch


def cut(x, start_s, length_s, overhang_ms):
    n = len(x)
    s = int(round(start_s * SR))
    L = int(round(length_s * SR))
    ov = min(int(round(overhang_ms / 1000 * SR)), L)
    if s + L + ov > n:
        sys.exit('the cut runs past the end of the source (%.3fs)' % (n / SR))
    out = x[s:s + L].copy()
    if ov > 0:
        t = np.arange(ov) / ov
        fade_in = np.sin(np.pi / 2 * t)[:, None]     # 0 -> 1, the head proper
        fade_out = np.cos(np.pi / 2 * t)[:, None]    # 1 -> 0, the continuation
        out[:ov] = out[:ov] * fade_in + x[s + L:s + L + ov] * fade_out
    return out


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def encode(x, path, bitrate, ch):
    pcm = np.clip(x, -1.0, 1.0).reshape(-1)
    raw = (pcm * 32767.0).astype('<i2').tobytes()
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y',
         '-f', 's16le', '-ar', str(SR), '-ac', str(ch), '-i', 'pipe:0',
         '-c:a', 'libopus', '-b:a', bitrate, '-map_metadata', '-1', path],
        input=raw, check=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--src', default=SRC)
    p.add_argument('--out-name', default=OUT_NAME)
    p.add_argument('--start', type=float, default=START_S)
    p.add_argument('--length', type=float, default=LENGTH_S)
    p.add_argument('--overhang', type=float, default=OVERHANG_MS)
    p.add_argument('--bitrate', default=BITRATE)
    p.add_argument('--dry-run', action='store_true')
    a = p.parse_args()

    x, ch = decode(a.src)
    print('source   %s  %.2fs  %dch  peak %.3f  rms %.1f dBFS'
          % (os.path.basename(a.src), len(x) / SR, ch, np.abs(x).max(), rms_db(x)))

    out = cut(x, a.start, a.length, a.overhang)
    print('cut      %.3fs .. %.3fs   length %.3fs   overhang %.0fms'
          % (a.start, a.start + a.length, a.length, a.overhang))
    print('loop     peak %.3f  rms %.1f dBFS' % (np.abs(out).max(), rms_db(out)))

    # The seam as a waveform: a click is a jump between the last frame and the
    # first that is out of scale with the jumps either side of it.
    m = out.mean(axis=1)
    step = abs(float(m[0] - m[-1]))
    near = float(np.median(np.abs(np.diff(m[:2000]))))
    print('seam     |first - last| %.4f   vs median neighbour step %.4f' % (step, near))

    if a.dry_run:
        print('dry run, nothing written')
        return
    dst = os.path.join(OUT_DIR, a.out_name + '.ogg')
    encode(out, dst, a.bitrate, ch)
    src_kb = os.path.getsize(a.src) / 1024
    dst_kb = os.path.getsize(dst) / 1024
    print('wrote    %s  %.0f KB  (from %.0f KB, %.0f%% smaller)'
          % (dst, dst_kb, src_kb, 100 * (1 - dst_kb / src_kb)))
    print("PIN      MUSIC_LOOP: { ... '<assetKey>': %.3f }   in src/config.js" % a.length)


if __name__ == '__main__':
    main()
