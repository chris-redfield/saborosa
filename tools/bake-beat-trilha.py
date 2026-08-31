#!/usr/bin/env python3
"""
bake-beat-trilha.py — render the Beat Music Lab mix down to the one file the
beat 'em up plays.

    assets-v2/beatemup-dungeon/audio/tchum-tchap-tchap-N.ogg   the takes
        └── bake-beat-trilha.py ──►
    assets-v2/beatemup-dungeon/audio/trilha-mix-baked.ogg      a candidate

This is the flying dungeon's bake-trilha.py applied to the second soundtrack,
and it is a separate script rather than a flag on that one for the same reason
the tools are separate: it reads a different file, and the two mixes must not be
able to overwrite each other by a mistyped argument.

⚠️ THIS DOES NOT YET REPRODUCE THE TOOL'S OWN EXPORT, AND THAT IS UNRESOLVED.
The shipped track, assets-v2/beatemup-dungeon/audio/trilha-mix.ogg, came from
the lab's `export wav` and NOT from this script — which is why the default
output name is different, so a re-run cannot quietly replace an approved mix
with a different one.

What is known, from comparing this script's render against that export:
  · the pass SPACING agrees exactly (tchum 4 repeats every 2223.5ms in both,
    tchum 3 every 2093.5ms), so the repeat arithmetic is not the problem;
  · the pass COUNT was the problem once and is fixed — see PASS_EPS;
  · a least-squares fit of the export against this script's layers still leaves
    about three quarters of its energy unexplained, and tchum 3 fits at -19dB
    where it should fit at 0. Something about how that layer is placed or
    decoded differs, and it has not been found.
The likeliest suspect is the DECODED CONTENT, not the placement: ffmpeg and a
browser disagree about where an Opus stream starts as well as how long it is.
Until that is chased down, treat this script as the reproducible path in
progress and the lab's export as the source of the shipped file.

⚠️ AND THE EXPORT IS NO LONGER THE LAST STAGE. Since 2026-08-24 the shipped
trilha-mix.ogg is that export put through tools/crop-beat-trilha.py, which moves
the loop points off the bed take's file length and onto its downbeat -- the old
crop wrapped straight into 1.2s of the take's own dead lead-in and tail. If this
script ever does reproduce the export, it reproduces the UNCROPPED render and
still has to be followed by the crop; do not point it at the game's filename.

⚠️ THE MIX IS READ OUT OF tools/beat-music-lab.html, not typed in here.
DEFAULT_MIX and DEFAULT_MASTER in that file are the single source of truth for
the arrangement — the tool is where it was dialled in and where it can be heard,
and a second copy of those numbers here would be wrong the first time anyone
nudged an offset. Change the mix there, re-run this.

⚠️ NEVER RUN THE RESULT THROUGH build-sound.py. That script trims silence off
both ends of what it is given, which is right for a raw phone take and
catastrophic for a loop cropped to a downbeat: it would eat the quiet head and
tail and destroy the timing the tool exists to establish. This encodes straight
to the final ogg for that reason.

WHY BAKE AT ALL WHEN THE TOOL CAN `export wav`. Because the browser export
clamps into 16-bit and CANNOT do anything else. Three layers summed at 0 dB
overshoot full scale; live you get away with it, but the exported file has the
flat tops baked in — the first export of this mix had 62 samples pinned, with a
flat run of 22 in a row on one transient. This scales the whole mix under a
ceiling instead, which costs level and keeps the balance that was tuned.

    python3 tools/bake-beat-trilha.py
    python3 tools/bake-beat-trilha.py --out-name trilha-mix --bitrate 128k
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
LAB = os.path.join(HERE, 'beat-music-lab.html')
TAKES = os.path.join(ROOT, 'assets-v2', 'beatemup-dungeon', 'audio')
OUT_DIR = TAKES

SR = 48000            # what the tool renders at, and what the takes already are
BITRATE = '128k'
PEAK_CEILING_DB = -1.0

# How close to the loop end a repeat may start before it is treated as the NEXT
# cycle's first pass instead of this one's last.
#
# THIS IS NOT A FUDGE, IT IS A DECODER DISAGREEMENT. ffprobe reports the bed as
# 6.1465s and ffmpeg hands this script 6.133s of actual PCM; a browser's
# decodeAudioData reports its own third number. The differences are codec delay
# and padding, single-digit milliseconds, and they are invisible until they land
# either side of a comparison. With the loop set to the bed's own length -- the
# obvious, correct thing to do -- a bed 13ms shorter than the loop starts a
# SECOND pass 13ms before the end, and the whole 6-second take then wraps onto
# the head and doubles against itself 13ms out of phase. It is a flanged mess
# and it appears or does not appear depending on which decoder ran.
#
# 30ms is far larger than any codec padding and far smaller than any gap a
# person would place on purpose, so both sides now agree on the pass count
# whatever decoded them. Drops are NOT subject to it: those are times somebody
# typed, and they mean what they say.
PASS_EPS = 0.030


# --- reading the mix out of the tool ---------------------------------------

def js_literal(text):
    """Turn a JS object/array literal of plain data into Python.

    Deliberately narrow: comments, unquoted keys, trailing commas, single-quoted
    strings. Anything beyond that is not something the SETS table is allowed to
    contain anyway, and a parser that accepted more would fail later and less
    clearly.

    ⚠️ SINGLE QUOTES WERE ADDED 2026-08-28 AND THE OLD PARSER WAS NOT WRONG
    BEFORE. It only ever read DEFAULT_MIX, which is numbers, booleans and empty
    arrays -- there was no string in it to convert. Reading the whole SETS table
    brings in filenames, labels, colours and tap keys, so the narrowness had to
    widen by exactly one rule.

    ⚠️ COMMENTS ARE STRIPPED FIRST AND THAT ORDER MATTERS: a `//` inside a
    string would eat the rest of the line, and a colour like '#53d8fb' would be
    safe but a URL would not. Nothing in SETS contains either, and this is the
    line to look at first if that ever stops being true.
    """
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)      # block comments
    text = re.sub(r'//[^\n]*', '', text)                   # line comments
    # 'single' -> "double". No escape handling: these are filenames, names,
    # hex colours and one-character keys, and a quote inside one would be a
    # filename nobody should ship.
    text = re.sub(r"'([^'\n]*)'", r'"\1"', text)
    text = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', text)   # keys
    text = re.sub(r',(\s*[}\]])', r'\1', text)             # trailing commas
    return json.loads(text)


def read_mix(set_name='street'):
    if not os.path.isfile(LAB):
        sys.exit(f'ERROR: {LAB} not found — the mix lives in the tool')
    src = open(LAB, encoding='utf-8').read()

    def grab(name, open_ch, close_ch):
        i = src.find('const ' + name)
        if i < 0:
            sys.exit(f'ERROR: {name} not found in beat-music-lab.html')
        a = src.index(open_ch, i)
        # Brace-count rather than regex, and skip comments while doing it: both
        # literals carry block comments containing braces of their own, and a
        # lazy match stops in the middle of one.
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

    # ⚠️ THE LAB HOLDS MORE THAN ONE SONG SINCE 2026-08-28, so this reads the
    # named SET rather than the file's first `DEFAULT_MIX`. Two reasons it had to
    # change in the same commit as the lab, and the second is the real one:
    #
    #   1. `DEFAULT_MIX` is no longer a top-level literal -- it is an alias for
    #      the ACTIVE set, chosen from a query string that does not exist here.
    #   2. The old file scan was `re.findall(r"file: '...'")` over the WHOLE
    #      SOURCE, taking the first N matches. With a second song in the table
    #      that still returns the right answer -- but only because the street set
    #      happens to be written first, and it would have silently baked one
    #      song's mix against another song's FILES the day somebody reordered the
    #      table. Reading the set as one structure removes the ordering
    #      dependency instead of documenting it.
    sets = js_literal(grab('SETS', '{', '}'))
    if set_name not in sets:
        sys.exit(f'ERROR: no set {set_name!r} in beat-music-lab.html; '
                 f'have {", ".join(sets)}')
    S = sets[set_name]
    layers, master = S['mix'], S['master']
    if len(S['layers']) != len(layers):
        sys.exit(f'ERROR: set {set_name!r}: {len(S["layers"])} layers but '
                 f'{len(layers)} mix entries -- they must line up index for index')
    # The set owns its folder; `file` stays a bare filename everywhere it is
    # shown, exported or read. Same bargain the lab's loader makes.
    for L, spec in zip(layers, S['layers']):
        L['file'] = S.get('dir', '') + spec['file']
    return layers, master


# --- audio io ---------------------------------------------------------------

def decode(path):
    """Decode to float32 stereo at SR. Stereo throughout even though the takes
    are mono, so a stereo take dropped in later is not silently folded down."""
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

def place(out, src, at_sample, src_start, rate, gain, src_len=0):
    """Write one pass of a layer into the mix.

    `rate` resamples, it does not time-stretch — slowing a layer lowers its
    pitch, exactly as AudioBufferSourceNode.playbackRate does in the tool. A
    pitch-preserving stretch would sound different from what was approved.
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
    # ⚠️ THE OUT-POINT, IN SOURCE SAMPLES. `src_len` bounds how much of the take
    # this pass may read; 0 means to the end, the behaviour before `lenMs`.
    # ⚠️ IT IS DIVIDED BY `rate` BECAUSE `n` COUNTS OUTPUT SAMPLES -- the same
    # source/output distinction the tool's `srcDur` note describes, and the one
    # place a chop at rate != 1 would come out the wrong length.
    if src_len > 0:
        room = min(room, int(np.floor(src_len / rate)))
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
    """Mirror of the tool's render(): same placement, same wrap, same order."""
    loop = master['loopMs'] / 1000.0
    plays = []          # (file, src, at_sec, into_sec, rate, gain), for the tail

    print(f'  loop {master["loopMs"]}ms · wrap fade {master.get("wrapFadeMs", 0)}ms · '
          f'master {master.get("db", 0)}dB')

    decoded, spans = {}, []
    for L in layers:
        if not L.get('on', True):
            print(f'  - {L["file"]:<24} (off)')
            continue
        path = os.path.join(TAKES, L['file'])
        if not os.path.isfile(path):
            sys.exit(f'ERROR: take missing: {path}')
        src = decoded.get(L['file'])
        if src is None:
            src = decoded[L['file']] = decode(path)
        dur = src.shape[0] / SR
        trim = min(max(L.get('trimMs', 0) / 1000.0, 0.0), dur)
        rate = min(max(L.get('rate', 1.0), 0.25), 4.0)
        # ⚠️ `lenMs` — THE OUT-POINT, ADDED 2026-08-28 WITH THE TOOL'S `piece
        # length`. 0 means "to the end of the file", which is what every layer
        # did before it existed. It MUST agree with `pieceSec()` in
        # beat-music-lab.html: the tool and this script are two renderers of one
        # arrangement, and a chop that only one of them honours is a bake that
        # does not sound like what was approved.
        avail = max(0.0, dur - trim)
        length = min(L.get('lenMs', 0) / 1000.0, avail) if L.get('lenMs', 0) > 0 else avail
        clip = length / rate
        if clip <= 0.001:
            continue
        gain = db_to_gain(L.get('db', 0))

        ats = []
        if L.get('repeat', True):
            step = clip + max(0.0, L.get('gapMs', 0) / 1000.0)
            if step <= 0.001:
                continue
            at, guard = L.get('offsetMs', 0) / 1000.0, 0
            # A pass starting at (or within PASS_EPS of) the loop end is the
            # NEXT cycle's first pass, and emitting it here would double it.
            while True:
                ats.append(at)
                at += step
                guard += 1
                if at >= loop - PASS_EPS or guard > 4000:
                    break
        else:
            # A drop past the loop end is not in the loop — same rule the tool
            # draws greyed out and refuses to schedule.
            ats = [ms / 1000.0 for ms in L.get('drops', []) if ms / 1000.0 < loop]

        for at in ats:
            spans.append((L['file'], src, at, trim, rate, gain, length))
            plays.append(at + clip)
        print(f'  + {L["file"]:<24} {dur:6.3f}s  rate {rate:.3f}  '
              f'trim {L.get("trimMs", 0):4d}ms  '
              f'piece {("%dms" % L["lenMs"]) if L.get("lenMs", 0) > 0 else "all":>7}  '
              f'offset {L.get("offsetMs", 0):+5d}ms  '
              f'-> {len(ats)} pass{"es" if len(ats) != 1 else ""}')

    # Rendered PAST the loop end by however much the last event still needs, so
    # the wrap below folds real material onto the head instead of silence.
    tail = min(loop, max(0.0, max(plays) - loop)) if plays else 0.0
    total = int(np.ceil((loop + tail) * SR))
    out = np.zeros((total, 2), dtype=np.float32)
    for _f, src, at, trim, rate, gain, length in spans:
        place(out, src, int(round(at * SR)), trim * SR, rate, gain, length * SR)

    out *= db_to_gain(master.get('db', 0))

    # THE WRAP, AND WHY THERE IS NO CROSSFADE HERE. bake-trilha.py folds the
    # tail back with a linear crossfade, because there the layers are continuous
    # takes and the seam is a join between two pieces of the same music. These
    # are struck sounds: a hit near the loop end is still ringing when the loop
    # comes round, and played live it simply carries on over the top of the next
    # cycle. So the overhang is SUMMED onto the head rather than blended with
    # it -- that is not an approximation of the live behaviour, it is exactly
    # it. `wrapFadeMs` (0 by default) is there only for a tail piling up
    # somewhere it should not.
    loop_n = int(round(loop * SR))
    tail_n = max(0, min(int(round(tail * SR)), loop_n, total - loop_n))
    final = out[:loop_n].copy()
    if tail_n:
        fade_n = max(0, int(round(master.get('wrapFadeMs', 0) / 1000.0 * SR)))
        w = np.ones(tail_n, dtype=np.float32)
        if fade_n:
            w = np.maximum(0.0, 1.0 - np.arange(tail_n, dtype=np.float32) / fade_n)
        final[:tail_n] += out[loop_n:loop_n + tail_n] * w[:, None]
        print(f'  wrapped {tail * 1000:.0f}ms of ring-out back onto the head')

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
    # NOT 'trilha-mix': that is the shipped file and it came from the lab's
    # export, not from here. See the warning at the top.
    # ⚠️ WHICH SONG. Defaults to the street bed so every existing invocation and
    # habit bakes exactly what it always did. See read_mix().
    p.add_argument('--set', default='street',
                   help="which song in beat-music-lab.html's SETS table")
    p.add_argument('--out-name', default='trilha-mix-baked')
    p.add_argument('--bitrate', default=BITRATE)
    p.add_argument('--ceiling', type=float, default=PEAK_CEILING_DB,
                   help='dBFS the bake is not allowed to exceed')
    args = p.parse_args()

    for tool in ('ffmpeg', 'ffprobe'):
        if subprocess.run(['which', tool], capture_output=True).returncode:
            sys.exit(f'ERROR: {tool} not on PATH')

    layers, master = read_mix(args.set)
    print(f'mix read from {os.path.relpath(LAB, ROOT)}')
    final = bake(layers, master, args)

    os.makedirs(OUT_DIR, exist_ok=True)
    dst = os.path.join(OUT_DIR, args.out_name + '.ogg')
    chans = encode(final, dst, args.bitrate)
    print(f'\n{os.path.relpath(dst, ROOT)}  '
          f'{final.shape[0] / SR:.3f}s  {"mono" if chans == 1 else "stereo"}  '
          f'{os.path.getsize(dst) // 1024}KB')


if __name__ == '__main__':
    main()
