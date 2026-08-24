#!/usr/bin/env python3
"""
crop-beat-trilha.py -- move the beat 'em up's music loop points without
re-rendering the mix.

    assets-v2/beatemup-dungeon/audio/beat-trilha-mix.wav   the lab's export
        |__ crop-beat-trilha.py --start 745 --length 5115 -->
    assets-v2/beatemup-dungeon/audio/trilha-mix.ogg        what the game plays

WHY THIS EXISTS AS A SECOND STAGE. tools/beat-music-lab.html owns the
ARRANGEMENT -- which takes, at which offsets, at which level -- and its `export
wav` is the approved render. It does NOT own the LOOP POINTS: the lab's loopMs
opened at the bed take's whole file length (6146ms) because that is the only
crop that is certainly not wrong before anyone has listened, and the take has
727ms of dead lead-in and 472ms of dead tail inside that. Loop it and both fall
next to each other at the wrap: about nine tenths of a second where the only
things playing are two isolated ticks from the other takes. That is the "vacuum"
the user heard, and it is a CROP problem, not a mix problem.

⚠️ IT DELIBERATELY DOES NOT GO BACK THROUGH THE LAB. bake-beat-trilha.py still
does not reproduce the lab's own export (read the note at the top of it), so the
export is the only file that is known to sound like the approved mix. Re-cropping
that render keeps every balance decision bit-for-bit and changes only where the
loop begins and ends. Nothing about the arrangement is recomputed here.

⚠️ AND IT DOES NOT MODEL THE CROP IN THE LAB EITHER, because the lab cannot
express it. There a layer `repeat`s to fill the loop and its overhang wraps onto
the head; a bed trimmed to 745ms would be 5388ms long against a 5115ms loop, so
its last 273ms would double back over its own downbeat. Discarding a tail is not
a setting on that model. The lab's numbers stay as they are and stay correct for
what they describe -- they are stage one, this is stage two.

THE SOURCE IS THE WAV, NEVER THE OGG. Re-cropping trilha-mix.ogg would put a
second generation of Opus on the shipped file for no reason, and would also lock
in the previous crop: the material outside the loop window has to still exist to
be croppable. Always start from beat-trilha-mix.wav, which is the full 6146ms
render and is never overwritten by this script.

HOW THE WRAP IS MADE SEAMLESS. The render is treated as a CYCLE, not a strip:
the new loop is `render[(start + t) mod 6146]`. A cut point chosen for musical
reasons lands wherever it lands, which here is in the middle of a decaying hit,
so cutting flat would put a click on every wrap. Instead the material that
CONTINUES past the cut -- the rest of that hit's ring -- is faded and summed
back onto the head, which is where it was going to be heard anyway. This is the
same rule beat-music-lab.html uses for its own render overhang.

THE NUMBERS, AND HOW THEY WERE FOUND (defaults below):
  · start 745ms  -- the attack of the bed's loudest hit, the phrase's downbeat.
    Measured off a 1ms RMS envelope: -28dB at 745, -4dB by 805.
  · length 5115ms -- three bars of the bed. The take is hand-played and speeds
    up slightly (bars measure 1755, 1730, and by extrapolation ~1705ms), so
    there is no exact tempo to snap to. The value was picked by scanning
    5050..5320 for the cut that leaves NO silence straddling the wrap while
    keeping the envelope either side of it correlated. At 5115 the longest quiet
    stretch anywhere in the loop is 199ms, which is a rest the music already
    plays elsewhere. Before the crop it was about 900ms.

⚠️ THE LEVEL IS NOT TOUCHED. The export has 120 samples pinned at full scale
with a 22-sample flat top -- the browser clamps into 16-bit on export and cannot
do otherwise. Pulling it under a ceiling would be right in a bake and is wrong
here: this mix has been played and balanced against the punch effects, and a dB
off the bed is a change nobody asked for. Fix it upstream in a bake if it is
ever fixed.

⚠️ CONFIG.musicLoopSec IN beatemup-dungeon/src/config.js MUST MATCH --length.
sound.js pins loopEnd to it rather than trusting the decoded duration. Re-crop
and that number moves with it, or the game wraps somewhere the file does not.

    python3 tools/crop-beat-trilha.py
    python3 tools/crop-beat-trilha.py --start 745 --length 5115 --dry-run
"""
import argparse
import os
import subprocess
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
AUDIO = os.path.join(ROOT, 'assets-v2', 'beatemup-dungeon', 'audio')
SRC = os.path.join(AUDIO, 'beat-trilha-mix.wav')
DST = os.path.join(AUDIO, 'trilha-mix.ogg')

SR = 48000
BITRATE = '128k'

# Defaults: see THE NUMBERS in the docstring.
START_MS = 745
LENGTH_MS = 5115
# How much of the cut event's ring is carried over the wrap onto the head, and
# the fade applied to it. 100ms covers the tail of the hit the default cut lands
# in; anything left after that is below -45dB.
OVERHANG_MS = 100


def read_wav(path):
    with wave.open(path, 'rb') as w:
        if w.getsampwidth() != 2:
            sys.exit('expected 16-bit PCM, got %d bytes/sample' % w.getsampwidth())
        if w.getframerate() != SR:
            sys.exit('expected %dHz, got %d' % (SR, w.getframerate()))
        ch = w.getnchannels()
        raw = w.readframes(w.getnframes())
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x


# The hole is measured on a 20ms envelope, not a 1ms one. At 1ms a single
# stray sample above the floor splits one silence into two short ones and the
# number stops describing what anybody hears; 20ms is roughly where a tick stops
# reading as a tick and starts reading as part of the groove.
HOP_MS = 20
FLOOR_DB = -32.0


def envelope_db(x, hop_ms=HOP_MS):
    h = int(SR * hop_ms / 1000)
    n = len(x) // h
    rms = np.sqrt(np.mean(x[:n * h].reshape(n, h) ** 2, axis=1))
    return 20 * np.log10(np.maximum(rms, 1e-6))


def longest_quiet_ms(db, floor_db=FLOOR_DB):
    """Longest run under `floor_db`, over the loop played TWICE so a run
    straddling the wrap counts as one run and not as two short ones."""
    d = np.concatenate([db, db])
    best = cur = 0
    for v in d[:len(db) + len(db) // 2]:
        cur = cur + 1 if v < floor_db else 0
        best = max(best, cur)
    return best * HOP_MS


def crop(x, start_ms, length_ms, overhang_ms):
    m = len(x)
    s = int(round(start_ms / 1000 * SR))
    n = int(round(length_ms / 1000 * SR))
    ov = min(int(round(overhang_ms / 1000 * SR)), n)
    if n > m:
        sys.exit('--length %dms is longer than the %.0fms render' % (length_ms, m / SR * 1000))
    out = x[(np.arange(n) + s) % m].copy()
    if ov > 0:
        tail = x[(np.arange(ov) + s + n) % m]
        # Raised cosine down to zero: the ring is already decaying, this only
        # makes sure it does not stop on an edge.
        fade = 0.5 * (1 + np.cos(np.pi * np.arange(ov) / ov))
        out[:ov] += tail * fade
    return out


def encode(x, path, bitrate):
    pcm = np.clip(x, -1.0, 1.0)
    raw = (pcm * 32767.0).astype('<i2').tobytes()
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y',
         '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
         '-c:a', 'libopus', '-b:a', bitrate, '-map_metadata', '-1', path],
        input=raw, check=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--start', type=float, default=START_MS,
                   help='ms into the render where the loop begins (default %d)' % START_MS)
    p.add_argument('--length', type=float, default=LENGTH_MS,
                   help='loop length in ms; this is CONFIG.musicLoopSec (default %d)' % LENGTH_MS)
    p.add_argument('--overhang', type=float, default=OVERHANG_MS)
    p.add_argument('--src', default=SRC)
    p.add_argument('--out', default=DST)
    p.add_argument('--dry-run', action='store_true',
                   help='measure and report, write nothing')
    a = p.parse_args()

    x = read_wav(a.src)
    print('source   %s  %.3fs  peak %.3f' % (os.path.basename(a.src), len(x) / SR, np.abs(x).max()))

    before = envelope_db(x)
    out = crop(x, a.start, a.length, a.overhang)
    after = envelope_db(out)

    print('crop     start %.0fms  length %.0fms  overhang %.0fms' % (a.start, a.length, a.overhang))
    print('longest quiet stretch (under %gdB, wrap included):' % FLOOR_DB)
    print('   before  %4dms' % longest_quiet_ms(before))
    print('   after   %4dms' % longest_quiet_ms(after))

    # The seam, read as a waveform rather than an envelope: a click is a jump
    # between the last sample and the first, out of scale with the jumps either
    # side of it.
    step = abs(out[0] - out[-1])
    near = np.abs(np.diff(out[:64]))
    print('seam     |first - last| %.4f   vs median neighbour step %.4f' % (step, np.median(near)))
    print('peak     %.3f  (%d samples at full scale)'
          % (np.abs(out).max(), int(np.sum(np.abs(np.round(out * 32768)) >= 32767))))

    if a.dry_run:
        print('dry run, nothing written')
        return
    encode(out, a.out, BITRATE)
    print('wrote    %s  %.1f KB' % (a.out, os.path.getsize(a.out) / 1024))
    print('SET      CONFIG.musicLoopSec = %.3f   in beatemup-dungeon/src/config.js' % (a.length / 1000))


if __name__ == '__main__':
    main()
