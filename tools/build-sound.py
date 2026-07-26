#!/usr/bin/env python3
"""
build-sound.py — turn the delivered recordings into loop-ready game audio.

The soundtrack arrives as phone voice notes (WhatsApp PTT .ogg), which is a fine
way to write a jam soundtrack and a terrible way to ship one: every take has
roughly a second of dead air at the head and another at the tail, because the
recording starts when the thumb goes down and stops when it comes up. Loop that
raw and the track goes silent for two seconds every time it comes round — the
single most audible flaw a looping track can have, and it is not in the music,
it is in the file.

So the raw takes are MASTERS, kept exactly as delivered, and this builds the
game's copies from them:

    assets-v2/flying-dungeon/sound/   masters, whatever name they arrive with
        └── build-sound.py ──►
    assets-v2/flying-dungeon/audio/   what the game loads (and package.sh ships)

Per file: trim the silence off both ends, normalise loudness so one take does
not arrive twice as loud as the next, and put a few ms of fade on each edge so
the loop point does not click. The folder layout underneath is preserved, so
`sound/music/x.ogg` builds to `audio/music/x.ogg` and the music/sfx split the
delivery already has survives into the game.

⚠️ Names are DERIVED, not mapped. A phone recording is called
`WhatsApp Ptt 2026-07-26 at 09.55.30.ogg` and a renamed one is called
`sound-fx-trilha-01-09.55.30.ogg`; both build to `trilha-01.ogg` because the
trailing clock time and the `sound-fx-` prefix are stripped. That is what lets
new takes be dropped in and renamed at will without a manifest here to keep in
step — but it also means CONFIG.SOUNDS refers to the BUILT name, so check what
this printed before wiring a new clip up.

    python3 tools/build-sound.py            # build everything that changed
    python3 tools/build-sound.py --force    # rebuild regardless
    python3 tools/build-sound.py --only trilha-01
"""
import argparse
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                           # repo root
SRC = os.path.join(ROOT, 'assets-v2', 'flying-dungeon', 'sound')
OUT = os.path.join(ROOT, 'assets-v2', 'flying-dungeon', 'audio')

AUDIO_EXT = {'.ogg', '.mp3', '.wav', '.m4a', '.opus', '.aac', '.flac'}

# Opus in an .ogg container: every browser that can run this game has played it
# for years, it is far smaller than mp3 at the same quality, and the masters are
# already opus so there is no format hop to pay for. 96k mono is transparent for
# a voice-note-grade source; the bitrate is a flag because a real recording of a
# real instrument would want more.
BITRATE = '96k'

# Loudness target. -16 LUFS is the streaming-ish convention and leaves headroom
# for several clips playing at once — the gun loops UNDER the music, and two
# tracks each mastered to the ceiling would clip the moment the player fires.
LOUDNESS = 'I=-16:TP=-1.5:LRA=11'

# What counts as silence at the ends. -45dB is below the noise floor of a phone
# mic in a room but above the room tone itself, so this trims dead air and not
# quiet playing. Raise it if a take starts with a breath you want gone.
SILENCE_DB = '-45dB'

FADE_MS = 12          # ms of fade on each edge — kills the loop-point click


def built_name(stem):
    """The game-facing name for a delivered file. See the header warning."""
    s = stem.strip()
    s = re.sub(r'^WhatsApp Ptt \d{4}-\d{2}-\d{2} at ', '', s)   # phone default
    s = re.sub(r'^(sound-fx|sfx|sound)[-_]', '', s, flags=re.I)  # hand prefix
    s = re.sub(r'[-_ ]?\d{2}[.:]\d{2}[.:]\d{2}$', '', s)         # clock stamp
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return s or 'clip'


def sources():
    """Every master under sound/, as (abs path, relative dir, built stem)."""
    found = []
    for dirpath, _dirs, files in os.walk(SRC):
        rel = os.path.relpath(dirpath, SRC)
        rel = '' if rel == '.' else rel
        for f in sorted(files):
            stem, ext = os.path.splitext(f)
            if ext.lower() in AUDIO_EXT:
                found.append((os.path.join(dirpath, f), rel, built_name(stem)))
    return found


def duration(path):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', path],
        capture_output=True, text=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def build(src, dst, args):
    """Trim → normalise → fade → encode.

    The tail trim is the head trim done backwards: ffmpeg's silenceremove only
    looks at the start of a stream, so reversing the audio, trimming, and
    reversing it again is the standard way to reach the other end. It costs a
    full decode of a ten-second file, which is nothing.

    Order matters — trim BEFORE loudnorm. Measuring loudness with a second of
    silence still attached drags the average down and the normaliser pushes the
    music up to compensate, so the trimmed result comes out hot.
    """
    trim = (f'silenceremove=start_periods=1:start_threshold={args.silence_db}'
            ':start_silence=0:detection=peak')
    fade = args.fade_ms / 1000.0
    chain = [
        trim,
        'areverse', trim, 'areverse',
        f'loudnorm={args.loudness}',
        f'afade=t=in:st=0:d={fade}',
    ]
    # The out-fade has to be placed from the END, which needs the length — and
    # the length is only known after the trim. Cheap enough to measure twice:
    # build once to a temp, read it, then fade. Instead we use areverse again,
    # which needs no measurement at all and is exact.
    chain += ['areverse', f'afade=t=in:st=0:d={fade}', 'areverse']

    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', src,
           '-af', ','.join(chain),
           '-c:a', 'libopus', '-b:a', args.bitrate,
           '-vn', '-map_metadata', '-1', dst]
    subprocess.run(cmd, check=True)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--force', action='store_true',
                   help='rebuild even if the output is newer than the master')
    p.add_argument('--only', default=None,
                   help='build just this BUILT name (e.g. trilha-01)')
    p.add_argument('--bitrate', default=BITRATE)
    p.add_argument('--loudness', default=LOUDNESS)
    p.add_argument('--silence-db', default=SILENCE_DB)
    p.add_argument('--fade-ms', type=float, default=FADE_MS)
    args = p.parse_args()

    if not os.path.isdir(SRC):
        sys.exit(f'ERROR: no masters at {SRC}')
    for tool in ('ffmpeg', 'ffprobe'):
        if subprocess.run(['which', tool], capture_output=True).returncode:
            sys.exit(f'ERROR: {tool} not on PATH')

    files = sources()
    if not files:
        sys.exit(f'ERROR: no audio under {SRC}')

    built = 0
    for src, rel, stem in files:
        if args.only and stem != args.only:
            continue
        dstdir = os.path.join(OUT, rel)
        os.makedirs(dstdir, exist_ok=True)
        dst = os.path.join(dstdir, stem + '.ogg')
        if (not args.force and os.path.exists(dst)
                and os.path.getmtime(dst) >= os.path.getmtime(src)):
            print(f'  = {os.path.join(rel, stem)}.ogg (up to date)')
            continue
        before = duration(src)
        build(src, dst, args)
        after = duration(dst)
        rel_name = os.path.join(rel, stem + '.ogg')
        print(f'  + {rel_name:<28} {before:5.2f}s -> {after:5.2f}s '
              f'(trimmed {before - after:.2f}s)  {os.path.getsize(dst) // 1024}KB')
        built += 1

    print(f'\n{built} built into {OUT}')
    if built:
        print('Wire clips up by their BUILT name in CONFIG.SOUNDS.')


if __name__ == '__main__':
    main()
