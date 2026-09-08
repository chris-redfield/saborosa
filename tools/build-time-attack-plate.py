#!/usr/bin/env python3
"""Turn a hand-filmed orbit into a background plate that LOOPS.

THE FOOTAGE. `time-attack-1-background.mp4` is a phone walked around a pile of
flat stones -- 848x478, 30fps, 50.85s, 2.05 Mbps, which is the same shape as
every other plate in this game. The brief was *"the video is about a person
filming a mount of stones circularly... since this was human filmed, its not
perfect the position of the camera, so the loop may become kinda ugly, can we
experiment with it? like try to find an optimal position and try to loop the
video when the camera is at the same position?"*

⚠️ THE ANSWER IS THAT THE CAMERA NEVER RETURNS, AND MEASURING IT IS WHY THIS
TOOL EXISTS. Two things were measured on the first clip before any cut was made:

  1. NO FRAME PAIR IN IT LOOKS LIKE THE SAME CAMERA POSITION. Normalised-frame
     distance from frame 0 to every later frame never comes back down: the
     minimum after 35s is 1.29 against 0.39 for two ADJACENT frames. A full
     self-similarity search over every pair 20-60s apart, window-matched so
     direction and speed count too, found nothing better than 1.22 against a
     1.40 average. There is no "same position" to cut on.

  2. AND THERE COULD NOT BE. The shot is a CLOSE-UP -- stones fill the frame,
     no horizon, no landmark. Coming back to the same position would mean
     centimetre precision from a hand-held phone, and a few centimetres out is a
     completely different arrangement of stones.

⚠️ SO THE THING THAT MUST MATCH IS VELOCITY, NOT POSITION. Phase correlation per
frame pair says the pan is a steady ~1.0 px/frame leftward (at 128px wide;
9.1 frame-widths in total) with hesitations, and -- the part that actually
mattered -- **the camera is DEAD STILL for the first 2.6s and the last 2.8s**.
5.4 seconds of frozen shot, over a tenth of the clip. That reads as the camera
stopping, which is worse than any seam, so both ends are cut off. `--analyse`
prints the whole profile; the defaults below came out of it.

WHAT IT BUILDS: a clip that loops seamlessly ON ITSELF, by wrap-crossfading its
own tail into its own head. Given a cut [t0, t1] and a fade D:

    out = xfade(clip[t1-D : t1] -> clip[t0 : t0+D])  ++  clip[t0+D : t1-D]

which is `t1 - t0 - D` long and joins end-to-start continuously: the output ends
on content from `t1-D`, and begins on content from `t1-D` dissolving forward.
⚠️ A DISSOLVE IS THE RIGHT TOOL *BECAUSE* THE SHOT IS FEATURELESS. Both sides of
it are the same texture drifting left at the same speed, so there is nothing for
the eye to lock onto and notice; the same fade over a scene with a horizon in it
would read as an obvious mix.

⚠️ AND NOT A PING-PONG. Playing it forwards then backwards is seamless by
construction and was rejected on the measurement: the pan is MONOTONIC, so a
reversal reads as the camera turning round and walking back, which is a bigger
lie than a dissolve.

VERIFIED, NOT ASSUMED. `--verify` re-decodes the OUTPUT and compares its wrap
step against its own average frame step:

    wrap-crossfade 0.6s     wrap 0.452  vs adjacent 0.414   ->  1.09x, seamless
    hard cut, same points   wrap 1.294  vs adjacent 0.413   ->  3.1x, visible
    the source looped as-is wrap 1.353  vs adjacent 0.387   ->  3.5x, visible

⚠️ IT MUST BE AN ffmpeg WITH libx264, AND THE FIRST ONE ON $PATH HERE IS NOT.
Every other video tool in this repo only DECODES, so a conda ffmpeg built
without libx264 served them fine; this one ENCODES and dies with "Unrecognized
option 'preset'" on that build. The encoder is probed rather than hardcoded.

  python3 tools/build-time-attack-plate.py --analyse     # the motion profile
  python3 tools/build-time-attack-plate.py               # cut, fade, encode
  python3 tools/build-time-attack-plate.py --crf 32 --seam-preview
"""
import argparse, os, shutil, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon/time-attack')
SRC  = os.path.join(DIR, 'time-attack-1-background.mp4')
OUT  = os.path.join(DIR, 'time-attack-1-plate.mp4')

# The cut, in seconds of the SOURCE. Both ends sit at the cruise speed of
# 1.00 px/frame -- see --analyse. 5.5 clears the 2.6s of stillness AND the
# jerky acceleration behind it (which peaks at 2.0 px/frame around 3.5s and
# stalls again at 4.3s); 47.5 stops before the camera settles at 48.0.
T0, T1 = 5.5, 47.5
FADE   = 0.6      # the wrap dissolve, seconds
CRF    = 30       # 5.9MB against the source's 11.6MB for the same 42s
GRID   = (128, 72)


def ffmpeg_with_x264():
    """⚠️ The first ffmpeg on PATH may not be able to encode. See the header."""
    for cand in ('ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'):
        exe = shutil.which(cand) or (cand if os.path.exists(cand) else None)
        if not exe: continue
        r = subprocess.run([exe, '-hide_banner', '-encoders'],
                           capture_output=True, text=True)
        if 'libx264' in r.stdout: return exe
    sys.exit('no ffmpeg with libx264 found. Every other video tool here only '
             'decodes, so a decode-only build is enough for them and not for '
             'this one.')


def gray(exe, path, ss=None, t=None):
    """The clip as (n, 72, 128) uint8 -- small, grey, and enough for motion."""
    cmd = [exe, '-v', 'error']
    if ss is not None: cmd += ['-ss', str(ss)]
    if t  is not None: cmd += ['-t',  str(t)]
    cmd += ['-i', path, '-vf', 'scale=%d:%d,format=gray' % GRID, '-f', 'rawvideo', '-']
    r = subprocess.run(cmd, capture_output=True)
    a = np.frombuffer(r.stdout, dtype=np.uint8)
    px = GRID[0] * GRID[1]
    n = a.size // px
    return a[:n * px].reshape(n, GRID[1], GRID[0]).astype(np.float32)


def normed(a):
    """Frames as unit-variance vectors, so exposure drift does not read as motion."""
    f = a.reshape(len(a), -1)
    return (f - f.mean(1, keepdims=True)) / (f.std(1, keepdims=True) + 1e-6)


def motion(a):
    """Per-frame global (dx) by phase correlation. Positive is rightward."""
    n, H, W = a.shape
    win = np.outer(np.hanning(H), np.hanning(W))
    F = np.fft.rfft2(a * win)
    dx = np.zeros(n)
    for i in range(1, n):
        R = F[i] * np.conj(F[i - 1]); R /= (np.abs(R) + 1e-9)
        c = np.fft.irfft2(R, s=(H, W))
        y, x = np.unravel_index(np.argmax(c), c.shape)
        dx[i] = x - W if x > W // 2 else x
    return dx


def analyse(exe, src):
    a = gray(exe, src)
    n = len(a); fps = 30.0
    dx = motion(a)
    k = np.convolve(np.abs(dx), np.ones(30) / 30, 'same')
    cruise = np.median(k[int(4 * fps):int(n - 4 * fps)])
    print('%s\n  %d frames, %.2fs' % (os.path.basename(src), n, n / fps))
    print('  cruise pan %.2f px/frame at %dpx wide; %.1f frame-widths travelled'
          % (cruise, GRID[0], abs(dx.sum()) / GRID[0]))
    still = k < cruise * 0.35
    head = 0
    while head < n and still[head]: head += 1
    tail = n - 1
    while tail > 0 and still[tail]: tail -= 1
    print('  ⚠️ STILL for the first %.2fs and the last %.2fs -- cut both'
          % (head / fps, (n - 1 - tail) / fps))
    print('\n  smoothed |dx| every 2s:')
    for i in range(0, n, 60):
        bar = '#' * int(round(k[i] / max(cruise, 1e-6) * 20))
        print('    %5.1fs %5.2f %s' % (i / fps, k[i], bar))
    # Does the camera ever come back? Answer for the record, not for a decision.
    f = normed(a)
    adj = float(np.mean([np.sqrt(((f[i] - f[i + 1]) ** 2).mean()) for i in range(n - 1)]))
    d0 = np.sqrt(((f - f[0]) ** 2).mean(1))
    j = int(60 + np.argmin(d0[60:]))
    print('\n  adjacent-frame distance %.3f' % adj)
    print('  closest any later frame gets to frame 0: %.3f at %.2fs (%.1fx a frame step)'
          % (d0[j], j / fps, d0[j] / adj))
    print('  ⚠️ anything above ~1.6x is a visible jump -- there is no "same position" here.')


def verify(exe, path):
    f = normed(gray(exe, path))
    adj = float(np.mean([np.sqrt(((f[i] - f[i + 1]) ** 2).mean()) for i in range(len(f) - 1)]))
    wrap = float(np.sqrt(((f[-1] - f[0]) ** 2).mean()))
    ok = wrap < adj * 1.6
    print('  wrap %.3f vs adjacent %.3f  ->  %.2fx  %s'
          % (wrap, adj, wrap / adj, 'SEAMLESS' if ok else '⚠️ VISIBLE JUMP'))
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--t0', type=float, default=T0)
    ap.add_argument('--t1', type=float, default=T1)
    ap.add_argument('--fade', type=float, default=FADE)
    ap.add_argument('--crf', type=int, default=CRF)
    ap.add_argument('--analyse', action='store_true', help='motion profile only')
    ap.add_argument('--seam-preview', action='store_true',
                    help='also write a clip that plays ACROSS the wrap, to watch')
    a = ap.parse_args()
    exe = ffmpeg_with_x264()

    if a.analyse:
        analyse(exe, a.src); return

    t0, t1, d = a.t0, a.t1, a.fade
    if t1 - t0 <= 2 * d: sys.exit('the cut is shorter than two fades')
    fc = ('[0:v]trim=start={ts}:end={t1},setpts=PTS-STARTPTS[tail];'
          '[0:v]trim=start={t0}:end={he},setpts=PTS-STARTPTS[head];'
          '[0:v]trim=start={he}:end={ts},setpts=PTS-STARTPTS[mid];'
          '[tail][head]xfade=transition=fade:duration={d}:offset=0[blend];'
          '[blend][mid]concat=n=2:v=1:a=0[out]'
          ).format(t0=t0, t1=t1, he=t0 + d, ts=t1 - d, d=d)
    # ⚠️ `-an` IS THE POINT, not a default: the source carries a 256kbps AAC
    # track of whoever was holding the phone, and this is scenery.
    subprocess.run([exe, '-hide_banner', '-v', 'error', '-i', a.src,
                    '-filter_complex', fc, '-map', '[out]', '-an',
                    '-c:v', 'libx264', '-crf', str(a.crf), '-preset', 'slow',
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                    '-y', a.out], check=True)
    src_sz, out_sz = os.path.getsize(a.src), os.path.getsize(a.out)
    print('%s\n  cut %.2f-%.2fs, wrap fade %.2fs  ->  %.2fs loop'
          % (os.path.basename(a.out), t0, t1, d, t1 - t0 - d))
    print('  %.2f MB at crf %d, from %.2f MB (-%.0f%%), no audio'
          % (out_sz / 1048576, a.crf, src_sz / 1048576, 100 * (1 - out_sz / src_sz)))
    verify(exe, a.out)

    if a.seam_preview:
        # Play it twice and keep the seconds around the join, so the seam can be
        # WATCHED rather than trusted. ⚠️ concat demuxer, not a filter: it is the
        # same decode path the game's <video> loop takes.
        lst = a.out + '.concat.txt'
        with open(lst, 'w') as fh:
            fh.write('file %s\nfile %s\n' % (repr(a.out), repr(a.out)))
        L = t1 - t0 - d
        prev = a.out.replace('.mp4', '-seam-preview.mp4')
        subprocess.run([exe, '-hide_banner', '-v', 'error', '-f', 'concat',
                        '-safe', '0', '-i', lst, '-ss', str(max(0, L - 4)),
                        '-t', '8', '-an', '-c:v', 'libx264', '-crf', '20',
                        '-preset', 'fast', '-pix_fmt', 'yuv420p', '-y', prev], check=True)
        os.remove(lst)
        print('  seam preview: %s (the wrap is at 4.0s of 8)' % os.path.basename(prev))


main()
