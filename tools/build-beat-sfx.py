#!/usr/bin/env python3
"""
build-beat-sfx.py — cut a game sound effect out of a recording of one.

    assets-v2/beatemup-dungeon/audio/<name>.ogg        the take, as recorded
        └── build-beat-sfx.py ──►
    assets-v2/beatemup-dungeon/audio/sfx/<name>.ogg    what the game plays

THE PROBLEM THIS SOLVES. These sounds are performed into a phone: the recording
starts when the thumb goes down, the sound happens somewhere in the middle, and
it stops when the thumb comes up. single-hit.ogg is 2.17 seconds long and the
hit is 300 milliseconds of it, starting at 958ms. Play the file on a connect and
the punch lands almost a second before you hear it.

⚠️ NOT build-sound.py, AND THE DIFFERENCE MATTERS. That script trims silence off
both ENDS and keeps everything between them. That is right for a musical take,
where the middle is the performance. It is wrong here: several of these
recordings hold a second, much quieter event -- a breath, a retake, a knock --
and keeping the span between the first and last sound keeps all the dead air in
between as well. single-hit.ogg has one 25 dB down at 1964ms, a second after the
hit, and trimming the ends would have produced a one-second effect with a hole
in it.

So this finds the EVENTS and takes one, by default the loudest. `--event all`
gets the old behaviour for a take that really is one phrase. `--event last`
takes the final one, which is what a combo take is for: combo-1-4-hits.ogg is
three ordinary punches and a FINISHER, and the finisher is the only part of it
the game wants on its own.

⚠️ EVENT SPLITTING IS NOT ALWAYS CLEAN, AND IT DOES NOT HAVE TO BE. In that
same take, hits 2 and 3 refuse to separate at any gap setting -- the dip between
them never falls far enough below the gate. That does not matter when what you
want is the last one, and chasing a setting that splits all four would only
find a gate so tight it clipped the decays. Read the event list this prints,
take the one you need, and leave the rest merged.

THE GATE IS SET TWO WAYS AND THE STRICTER ONE WINS, because either alone gets
this file wrong.

Measuring the noise floor and gating a margin above it is the obvious method,
and on single-hit.ogg it fails: the take holds BOTH room tone at about -61 dB
AND a stretch of true digital silence at -92, so the quietest half second finds
the digital silence, the floor reads -69, the gate sits at -57 -- under the room
tone -- and the "event" starts at 68ms and runs for 1.2 seconds. That is the
whole bug this tool exists to prevent, arrived at from the other direction.

So the gate is also held within `--range` dB of the file's PEAK. An impact
effect lives in the top 40 dB of its own dynamic range; room tone 50 dB down
does not, whatever the floor happens to measure. The floor rule still does the
work on a quiet effect in a hissy room, where the peak rule would be too loose.

    python3 tools/build-beat-sfx.py single-hit
    python3 tools/build-beat-sfx.py combo-1-4-hits --event all
    python3 tools/build-beat-sfx.py enemy-hit-1 --dry-run
"""
import argparse
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets-v2', 'beatemup-dungeon', 'audio')
OUT = os.path.join(SRC, 'sfx')

SR = 48000
BITRATE = '96k'          # a 300ms percussive hit; 128k buys nothing audible
FRAME_MS = 1.0


def decode(path):
    p = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le',
         '-ac', '1', '-ar', str(SR), '-'],
        capture_output=True)
    if p.returncode:
        sys.exit(f'ERROR decoding {path}:\n{p.stderr.decode()[:400]}')
    return np.frombuffer(p.stdout, dtype='<f4').astype(np.float64)


def encode(audio, path, bitrate):
    p = subprocess.run(
        ['ffmpeg', '-v', 'error', '-y',
         '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
         '-c:a', 'libopus', '-b:a', bitrate, '-map_metadata', '-1', path],
        input=audio.astype('<f4').tobytes(), capture_output=True)
    if p.returncode:
        sys.exit(f'ERROR encoding {path}:\n{p.stderr.decode()[:400]}')


def envelope(a, frame):
    n = a.size // frame
    if n < 1:
        return np.array([-120.0])
    e = np.sqrt(np.mean(a[:n * frame].reshape(n, frame) ** 2, axis=1))
    return 20 * np.log10(np.maximum(e, 1e-7))


def find_events(db, gate, gap_frames, min_frames):
    """Contiguous runs above `gate`, merged across short dips."""
    hot = db > gate
    runs = []
    i = 0
    while i < hot.size:
        if not hot[i]:
            i += 1
            continue
        j = i
        while j < hot.size and hot[j]:
            j += 1
        runs.append([i, j])
        i = j
    if not runs:
        return []
    # A hit and its own decay dip below the gate repeatedly; without this every
    # ring of a cymbal would come out as its own "event".
    merged = [runs[0]]
    for a, b in runs[1:]:
        if a - merged[-1][1] <= gap_frames:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [r for r in merged if r[1] - r[0] >= min_frames]


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('name', help='take under assets-v2/beatemup-dungeon/audio, with or without .ogg')
    p.add_argument('--event', default='loudest',
                   help="'loudest' (default), 'last', 'all', or a 1-based event number")
    p.add_argument('--margin', type=float, default=12.0,
                   help='dB above the measured noise floor that counts as sound')
    p.add_argument('--range', type=float, default=40.0,
                   help='dB below the file peak that still counts as sound')
    p.add_argument('--gap', type=float, default=120.0,
                   help='ms of quiet that still belongs to the same event')
    p.add_argument('--min', type=float, default=20.0, help='ms: shorter runs are noise')
    p.add_argument('--pre', type=float, default=6.0, help='ms kept before the onset')
    p.add_argument('--post', type=float, default=25.0, help='ms kept after the decay')
    p.add_argument('--fade-in', type=float, default=2.0, help='ms')
    p.add_argument('--fade-out', type=float, default=12.0, help='ms')
    p.add_argument('--peak', type=float, default=-1.0,
                   help='dBFS to normalise the result to; use --peak 0 to leave the level alone')
    p.add_argument('--bitrate', default=BITRATE)
    p.add_argument('--out', default=None,
                   help='output name, when the cut is not the whole take '
                        '(e.g. the finisher out of a combo)')
    p.add_argument('--dry-run', action='store_true', help='report and write nothing')
    args = p.parse_args()

    name = args.name[:-4] if args.name.endswith('.ogg') else args.name
    src = os.path.join(SRC, name + '.ogg')
    if not os.path.isfile(src):
        sys.exit(f'ERROR: no take at {src}')

    a = decode(src)
    frame = int(SR * FRAME_MS / 1000)
    db = envelope(a, frame)

    # The floor is the quietest half second, so a hissy room and a silent one
    # both gate correctly.
    win = max(1, int(500 / FRAME_MS))
    if db.size > win:
        sums = np.convolve(10 ** (db / 10), np.ones(win) / win, mode='valid')
        floor = 10 * np.log10(sums.min())
    else:
        floor = float(np.min(db))
    peak_db = 20 * np.log10(max(np.max(np.abs(a)), 1e-7))
    # The stricter of the two -- see the header.
    gate = max(floor + args.margin, peak_db - args.range)

    events = find_events(db, gate, int(args.gap / FRAME_MS), int(args.min / FRAME_MS))
    if not events:
        sys.exit(f'ERROR: nothing above {gate:+.1f} dB in {name}.ogg — '
                 f'lower --margin (floor is {floor:+.1f} dB)')

    print(f'{name}.ogg  {a.size / SR:.3f}s  peak {20 * np.log10(np.max(np.abs(a))):+.1f} dBFS')
    which = 'floor+margin' if floor + args.margin >= peak_db - args.range else 'peak-range'
    print(f'  noise floor {floor:+.1f} dB, gate {gate:+.1f} dB ({which}) '
          f'-> {len(events)} event(s)')
    peaks = []
    for k, (i, j) in enumerate(events, 1):
        pk = float(np.max(db[i:j]))
        peaks.append(pk)
        print(f'    {k}: {i * FRAME_MS:7.0f} - {j * FRAME_MS:7.0f} ms  '
              f'({(j - i) * FRAME_MS:5.0f} ms)  peak {pk:+6.1f} dB')

    if args.event == 'all':
        i0, j1 = events[0][0], events[-1][1]
    elif args.event == 'last':
        i0, j1 = events[-1]
    elif args.event == 'loudest':
        i0, j1 = events[int(np.argmax(peaks))]
    else:
        k = int(args.event)
        if not 1 <= k <= len(events):
            sys.exit(f'ERROR: --event {k} but there are {len(events)}')
        i0, j1 = events[k - 1]

    s = max(0, int((i0 * FRAME_MS - args.pre) / 1000 * SR))
    e = min(a.size, int((j1 * FRAME_MS + args.post) / 1000 * SR))
    cut = a[s:e].copy()

    # Fades, because the cut lands in room tone rather than in true silence and
    # a step from -60 dB to nothing is still a click.
    fi = min(int(args.fade_in / 1000 * SR), cut.size // 2)
    fo = min(int(args.fade_out / 1000 * SR), cut.size // 2)
    if fi:
        cut[:fi] *= np.linspace(0, 1, fi)
    if fo:
        cut[-fo:] *= np.linspace(1, 0, fo)

    pk = float(np.max(np.abs(cut))) or 1.0
    if args.peak != 0:
        cut *= (10 ** (args.peak / 20.0)) / pk

    print(f'  keeping {s / SR * 1000:.0f} - {e / SR * 1000:.0f} ms '
          f'= {cut.size / SR * 1000:.0f} ms, '
          f'{(1 - cut.size / a.size) * 100:.1f}% of the take discarded')

    if args.dry_run:
        print('  (dry run, nothing written)')
        return
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, (args.out or name) + '.ogg')
    encode(cut, dst, args.bitrate)
    print(f'\n{os.path.relpath(dst, ROOT)}  {cut.size / SR * 1000:.0f} ms  '
          f'{os.path.getsize(dst) // 1024}KB')


if __name__ == '__main__':
    main()
