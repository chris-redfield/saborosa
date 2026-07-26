#!/usr/bin/env python3
"""
bake-trilha.py — render the Music Lab mix down to the one file the game plays.

The background music is three separate takes layered and aligned. The game does
not do that layering: it plays ONE looping file, because three <audio> elements
started independently drift apart within a minute and there is no way to bind
them together. So the mix is resolved here, once, offline.

    assets-v2/flying-dungeon/audio/music/trilha-0N.ogg   the aligned stems
        └── bake-trilha.py ──►
    assets-v2/flying-dungeon/audio/trilha-mix.ogg        what the game loads

⚠️ THE MIX IS READ OUT OF tools/music-lab.html, not typed in here. DEFAULT_MIX
and DEFAULT_MASTER in that file are the single source of truth for the
arrangement — the tool is where it was dialled in and where it can be heard, and
a second copy of those numbers in this script would be wrong the first time
anyone nudged an offset. Change the mix there, re-run this.

⚠️ NEVER RUN THE RESULT THROUGH build-sound.py. That script trims silence off
both ends of what it is given, which is exactly right for a raw phone take and
catastrophic for a loop that has been cropped to a downbeat: it would eat the
quiet head and tail and destroy the timing the whole tool exists to establish.
This encodes straight to the final ogg for that reason.

    python3 tools/bake-trilha.py
    python3 tools/bake-trilha.py --out-name trilha-mix --bitrate 128k
"""
import argparse
import json
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAB = os.path.join(HERE, 'music-lab.html')
STEMS = os.path.join(ROOT, 'assets-v2', 'flying-dungeon', 'audio', 'music')
OUT_DIR = os.path.join(ROOT, 'assets-v2', 'flying-dungeon', 'audio')

SR = 48000            # what the tool renders at, and what the stems already are
BITRATE = '128k'

# Headroom the bake will not exceed. Three layers summed at 0 dB overshoot full
# scale — the browser hides it (its output clips on the way to the DAC and you
# hear a mix that is merely a bit gritty), but writing a clipped FILE bakes the
# distortion in for good. If the sum overshoots, the WHOLE mix is scaled down by
# the smallest amount that fixes it: overall level is the game's volume knob's
# problem, and scaling everything equally leaves the balance between the layers
# — the thing that was actually tuned — untouched.
PEAK_CEILING_DB = -1.0


# --- reading the mix out of the tool ---------------------------------------

def js_literal(text):
    """Turn a JS object/array literal of plain data into Python.

    Deliberately narrow: comments, unquoted keys, trailing commas. Anything
    beyond that is not something DEFAULT_MIX is allowed to contain anyway, and
    a parser that accepted more would fail later and less clearly.
    """
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)      # block comments
    text = re.sub(r'//[^\n]*', '', text)                   # line comments
    text = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', text)   # keys
    text = re.sub(r',(\s*[}\]])', r'\1', text)             # trailing commas
    return json.loads(text)


def read_mix():
    if not os.path.isfile(LAB):
        sys.exit(f'ERROR: {LAB} not found — the mix lives in the tool')
    src = open(LAB, encoding='utf-8').read()

    def grab(name, open_ch, close_ch):
        i = src.find('const ' + name)
        if i < 0:
            sys.exit(f'ERROR: {name} not found in music-lab.html')
        a = src.index(open_ch, i)
        # Brace-count rather than regex: DEFAULT_MASTER's comment contains
        # braces of its own and a lazy match stops in the middle of it.
        depth, j, in_block, in_line = 0, a, False, False
        while j < len(src):
            two = src[j:j + 2]
            if in_block:
                if two == '*/':
                    in_block = False
                    j += 2
                    continue
            elif in_line:
                if src[j] == '\n':
                    in_line = False
            elif two == '/*':
                in_block = True
                j += 2
                continue
            elif two == '//':
                in_line = True
            elif src[j] == open_ch:
                depth += 1
            elif src[j] == close_ch:
                depth -= 1
                if depth == 0:
                    return src[a:j + 1]
            j += 1
        sys.exit(f'ERROR: {name} is not closed')

    layers = js_literal(grab('DEFAULT_MIX', '[', ']'))
    master = js_literal(grab('DEFAULT_MASTER', '{', '}'))

    files = re.findall(r"file:\s*'([^']+)'", src)
    if len(files) < len(layers):
        sys.exit('ERROR: TRACKS and DEFAULT_MIX disagree about how many layers there are')
    for i, L in enumerate(layers):
        L['file'] = files[i]
    return layers, master


# --- audio io ---------------------------------------------------------------

def decode(path):
    """Decode to float32 stereo at SR. Stereo throughout even though the takes
    are mono, so a stereo master dropped in later is not silently folded down."""
    p = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le',
         '-ac', '2', '-ar', str(SR), '-'],
        capture_output=True)
    if p.returncode:
        sys.exit(f'ERROR decoding {path}:\n{p.stderr.decode()[:400]}')
    return np.frombuffer(p.stdout, dtype='<f4').reshape(-1, 2).astype(np.float32)


def encode(audio, path, bitrate):
    mono = np.allclose(audio[:, 0], audio[:, 1], atol=1e-6)
    data = audio[:, :1] if mono else audio
    p = subprocess.run(
        ['ffmpeg', '-v', 'error', '-y',
         '-f', 'f32le', '-ar', str(SR), '-ac', str(data.shape[1]), '-i', '-',
         '-c:a', 'libopus', '-b:a', bitrate, '-map_metadata', '-1', path],
        input=data.astype('<f4').tobytes(), capture_output=True)
    if p.returncode:
        sys.exit(f'ERROR encoding {path}:\n{p.stderr.decode()[:400]}')
    return 1 if mono else 2


# --- the render -------------------------------------------------------------

def place(out, src, at_sample, src_start, rate, gain):
    """Write one pass of a layer into the mix.

    `rate` resamples, it does not time-stretch — slowing a layer lowers its
    pitch, exactly as AudioBufferSourceNode.playbackRate does in the tool. A
    pitch-preserving stretch would sound different from what was approved.

    Linear interpolation between samples. At the fraction of a percent these
    rates sit at, the difference from a windowed-sinc resample is far below
    what a 96k opus encode of a phone recording can represent.
    """
    n_out, n_src = out.shape[0], src.shape[0]
    if at_sample >= n_out:
        return
    # Trim the front of the pass rather than the source when it starts before
    # the loop does: `at_sample` negative means part of it has already played.
    if at_sample < 0:
        src_start += (-at_sample) * rate
        at_sample = 0
    if src_start >= n_src - 1:
        return
    room = int(np.floor((n_src - 1 - src_start) / rate))
    n = min(room, n_out - at_sample)
    if n <= 0:
        return
    idx = src_start + np.arange(n, dtype=np.float64) * rate
    i0 = np.floor(idx).astype(np.int64)
    frac = (idx - i0).astype(np.float32)[:, None]
    seg = src[i0] * (1.0 - frac) + src[i0 + 1] * frac
    out[at_sample:at_sample + n] += seg * gain


def db_to_gain(db):
    return float(10.0 ** (db / 20.0))


def bake(layers, master, args):
    loop = master['loopMs'] / 1000.0
    seam = min(max(master.get('seamMs', 0), 0), master['loopMs'] / 2) / 1000.0
    # Rendered PAST the loop end, so the seam blend folds real material back
    # over the head instead of fading into silence.
    total = int(np.ceil((loop + seam) * SR))
    out = np.zeros((total, 2), dtype=np.float32)

    print(f'  loop {master["loopMs"]}ms · seam {master.get("seamMs", 0)}ms · '
          f'master {master.get("db", 0)}dB')

    for L in layers:
        if not L.get('on', True):
            print(f'  - {L["file"]}  (off)')
            continue
        path = os.path.join(STEMS, L['file'])
        if not os.path.isfile(path):
            sys.exit(f'ERROR: stem missing: {path}\nRun tools/build-sound.py first.')
        src = decode(path)
        dur = src.shape[0] / SR
        trim = min(max(L.get('trimMs', 0) / 1000.0, 0.0), dur)
        rate = min(max(L.get('rate', 1.0), 0.25), 4.0)
        clip = (dur - trim) / rate
        if clip <= 0.001:
            continue
        step = clip + max(0.0, L.get('gapMs', 0) / 1000.0)
        gain = db_to_gain(L.get('db', 0))

        at, passes, guard = L.get('offsetMs', 0) / 1000.0, 0, 0
        while True:
            place(out, src, int(round(at * SR)), trim * SR, rate, gain)
            passes += 1
            at += step
            guard += 1
            if not L.get('repeat', True) or at >= loop + seam or guard > 2000:
                break
        print(f'  + {L["file"]:<16} {dur:6.3f}s  rate {rate:.3f}  '
              f'offset {L.get("offsetMs", 0):+5d}ms  gap {L.get("gapMs", 0):3d}ms  '
              f'-> {passes} pass{"es" if passes != 1 else ""}')

    out *= db_to_gain(master.get('db', 0))

    # Fold the tail back over the head: at the wrap the outgoing tail is at full
    # and the new head at nothing, and `seam` later it is the other way round —
    # so looping the result is continuous through the join, with no level dip
    # and no click.
    loop_n = int(round(loop * SR))
    seam_n = max(0, min(int(round(seam * SR)), loop_n, total - loop_n))
    final = out[:loop_n].copy()
    if seam_n:
        w = (np.arange(seam_n, dtype=np.float32) / seam_n)[:, None]
        final[:seam_n] = out[:seam_n] * w + out[loop_n:loop_n + seam_n] * (1.0 - w)

    peak = float(np.max(np.abs(final))) if final.size else 0.0
    peak_db = 20 * np.log10(peak) if peak > 0 else -120.0
    ceiling = db_to_gain(args.ceiling)
    if peak > ceiling:
        final *= ceiling / peak
        print(f'  ! peak was {peak_db:+.1f} dBFS — scaled by '
              f'{20 * np.log10(ceiling / peak):+.1f} dB to sit at {args.ceiling:+.1f}. '
              f'Balance between layers unchanged.')
    else:
        print(f'  peak {peak_db:+.1f} dBFS')
    return final


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--out-name', default='trilha-mix')
    p.add_argument('--bitrate', default=BITRATE)
    p.add_argument('--ceiling', type=float, default=PEAK_CEILING_DB,
                   help='dBFS the bake is not allowed to exceed')
    args = p.parse_args()

    for tool in ('ffmpeg', 'ffprobe'):
        if subprocess.run(['which', tool], capture_output=True).returncode:
            sys.exit(f'ERROR: {tool} not on PATH')

    layers, master = read_mix()
    print(f'mix read from {os.path.relpath(LAB, ROOT)}')
    final = bake(layers, master, args)

    os.makedirs(OUT_DIR, exist_ok=True)
    dst = os.path.join(OUT_DIR, args.out_name + '.ogg')
    chans = encode(final, dst, args.bitrate)
    print(f'\n{os.path.relpath(dst, ROOT)}  '
          f'{final.shape[0] / SR:.3f}s  {"mono" if chans == 1 else "stereo"}  '
          f'{os.path.getsize(dst) // 1024}KB')
    print('Loops seamlessly end to end — do NOT run it through build-sound.py.')


if __name__ == '__main__':
    main()
