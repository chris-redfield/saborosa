#!/usr/bin/env python3
"""
compress-beat-soundtrack.py — shrink the soundtrack to something a game ships.

    assets-v2/beatemup-dungeon/soundtrack/originals/<song>.mp3   the master
        └── compress-beat-soundtrack.py ──►
    assets-v2/beatemup-dungeon/soundtrack/<song>.mp3             what ships

THE PROBLEM THIS SOLVES. The six songs arrived as 320 kbps CBR stereo, which is
the highest bitrate MP3 has, and together they are 52 MB — more than every other
asset in the game put together, and about twelve times the largest sprite sheet.
Asked 2026-09-08: *"is it possible to reduce the size of these mp3 files further
without losing too much audible sound?"*

⚠️ 320 kbps IS NOT A STATEMENT ABOUT THESE RECORDINGS, IT IS THE EXPORT DEFAULT.
Measured across the middle 60 seconds of each track, the energy above 16 kHz —
the first thing any lower bitrate discards — is between **0.002% and 0.041%** of
the total. Nothing else in this game is mastered anywhere near that: the music
already in it (`song-enmakun2011.mp3`) is 128 kbps and `mike-title.ogg` is about
110. These six were 2.5x the house standard for content that carries a
twenty-thousandth of the sound.

    Arrocha da Serpente          cutoff ~22.1 kHz   energy >16k: 0.021%
    Coco Nha Nha                 cutoff ~22.1 kHz   energy >16k: 0.031%
    Cumbia Corazon               cutoff ~22.1 kHz   energy >16k: 0.010%
    Dance Saborosa               cutoff ~22.1 kHz   energy >16k: 0.002%
    Pode Me Chamar               cutoff ~22.1 kHz   energy >16k: 0.038%
    Sucuri - Samuraio            cutoff ~22.1 kHz   energy >16k: 0.041%

⚠️ THE MASTERS ARE KEPT AND THEY ARE NOT COMMITTED, which is the same bargain
`assets-v2/flying-dungeon/originals/` already strikes in .gitignore. This is a
LOSSY source re-encoded LOSSILY — a second generation — so the one thing that
must never happen is the 320s being overwritten by their own output. Encoding is
therefore originals/ -> the folder above it, never in place, and re-running at a
different quality is always possible because the input never moves.

⚠️ AND THAT IS WHY THIS IS A SCRIPT RATHER THAN A COMMAND THAT WAS RUN ONCE. The
quality is a taste call nobody has made yet with their ears — the tracks are not
wired into the game at the time of writing — so the useful artifact is the thing
that re-runs, not the output of one guess.

⚠️ THE QUALITY LADDER IS MEASURED ON THESE SIX FILES, NOT QUOTED FROM LAME. The
published averages are badly wrong for this material -- V5 is "about 130 kbps"
everywhere it is written down, and on four of these tracks it produced 86-96,
BELOW the 128k the rest of the game's music ships at. Trust the left column:

    -q 5    86 - 141 kbps    17.2 MB   under the house standard on 4 of 6
    -q 4   104 - 164 kbps    20.3 MB   THE DEFAULT -- at or near 128k throughout
    -q 3   119 - 184 kbps    23.0 MB
    -q 2   136 - 202 kbps    26.0 MB
    (masters)    320 kbps    51.8 MB

V4 is the default for one reason beyond the numbers: **the masters are deleted**
(2026-09-08, asked for), so there is no going back up. Shipping the most
aggressive setting and then burning the only source is the one mistake here that
cannot be undone.

⚠️ VBR, NOT CBR, AND IT IS NOT A WASH. These are dense mixes with quiet passages;
constant bitrate spends the same on both, and at 128k CBR the loud bars are the
ones that suffer. VBR averages about the same and puts the bits where the music
is. The sizes above are what this actually produced, not estimates.

EVERY TRACK IS LOUDNESS-NORMALISED ON THE WAY THROUGH, and that is the other
half of what this script is for. Asked in the same breath as the size:
*"antes de incluir as musicas, tente regularizar o volume de todas elas"*.

⚠️ THEY WERE NOT "OK BETWEEN THEMSELVES" -- THEY SPANNED 7.7 dB. Measured EBU
R128 integrated, before this ran:

    Cumbia Corazon     -6.55 LUFS   true peak +1.21 dBTP   <- clips
    Sucuri             -9.22 LUFS   true peak +1.23 dBTP   <- clips
    Dance Saborosa    -10.73 LUFS   true peak +0.48 dBTP   <- clips
    Arrocha           -12.48 LUFS   true peak -4.33 dBTP
    Pode Me Chamar    -13.10 LUFS   true peak -3.23 dBTP
    Coco Nha Nha      -14.21 LUFS   true peak -3.21 dBTP

Cumbia is nearly 8 dB over Coco Nha Nha, and three of the six were already over
full scale before the game touched them -- so the boss theme would have arrived
shouting and the opening would have arrived timid, which is exactly the complaint
that was made about the tracks already in the game.

⚠️ TWO-PASS, NOT ONE. `loudnorm` in a single pass is a live compressor guessing
at the programme as it goes; measured first and then applied, it is a gain
calculation. On a 5-minute song the difference is audible -- one-pass pumps the
quiet intro up and then rides it back down when the band comes in.

⚠️ AND THE TARGET IS -16 LUFS / -1.5 dBTP, WHICH IS A CEILING AS MUCH AS A LEVEL.
The true-peak limit is what takes the three clipping tracks back under full scale;
without it, normalising a song that already peaks at +1.2 dBTP just moves where
it clips. -16 is where the music already in the game sits (-14.4, -15.3, -16.1),
so the new songs land among them rather than establishing a second standard.

⚠️ NORMALISING IS NOT THE SAME JOB AS `CONFIG.MUSIC_GAIN`, AND BOTH ARE NEEDED.
This makes the six agree WITH EACH OTHER, once, in the file. MUSIC_GAIN is how a
track sits under the sound effects IN PLAY, which is a mix decision that changes
when the bed changes -- see the long note on that block. Doing it here as well
would bake a play-balance into an asset and take the knob away.

⚠️ WHY MP3 AND NOT OGG. Vorbis q3 came out 2 MB smaller across all six (15 vs
17), which is not enough to be worth changing the extension for. What WOULD be
worth it is a seamless loop: an MP3 carries encoder delay and padding, so a track
looped by the player has a short gap at the seam that Vorbis would not have.
`sound.js` pins its loop from `MUSIC_LOOP.<key>` in seconds and that is tunable,
so this is a knob to set rather than a fault to fix — but if a bed here ever has
to loop INVISIBLY, re-run this with `--ogg` and wire the .ogg instead.

⚠️ NOTHING READS THESE FILES YET. No `src/` file names any of the six; they are
staged, not wired. So this script's output path is chosen to be the one the
manifest would name — `soundtrack/<song>.mp3`, the filenames unchanged — and
wiring a song later is a manifest entry, not a rename.

USAGE

    tools/compress-beat-soundtrack.py            # all of them, V5
    tools/compress-beat-soundtrack.py -q 4       # more margin
    tools/compress-beat-soundtrack.py --ogg      # Vorbis instead, for looping
    tools/compress-beat-soundtrack.py --dry-run  # sizes only, writes nothing
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, 'assets-v2', 'beatemup-dungeon', 'soundtrack')
SRC_DIR = os.path.join(OUT_DIR, 'originals')

# EBU R128 target. See the header: -16 LUFS is where the music already in the
# game sits, and the -1.5 dBTP ceiling is what takes the three tracks that were
# clipping back under full scale.
TARGET_I = -16.0
TARGET_TP = -1.5
TARGET_LRA = 11.0


def human(n):
    return f'{n / 1048576:.1f} MB'


def measure(path):
    """Pass one: what this file actually is, in EBU R128 terms.

    ⚠️ THE LAST JSON OBJECT, NOT THE FIRST. ffmpeg prints the filter graph's own
    chatter before it, and on a file with more than one stream there can be more
    than one block. The summary is always last.
    """
    r = subprocess.run(
        ['ffmpeg', '-v', 'info', '-i', path, '-af',
         f'loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json',
         '-f', 'null', '-'], stderr=subprocess.PIPE)
    blocks = re.findall(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr.decode(), re.S)
    if not blocks:
        return None
    try:
        return json.loads(blocks[-1])
    except ValueError:
        return None


def probe(path, entries):
    """One ffprobe field set, or None if the file will not open."""
    try:
        out = subprocess.check_output(
            ['ffprobe', '-v', 'error', '-show_entries', entries,
             '-of', 'default=noprint_wrappers=1:nokey=1', path],
            stderr=subprocess.DEVNULL).decode().split()
        return out
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-q', '--quality', type=int, default=4,
                    help='LAME VBR quality, 0 (best) to 9. Default 4 (~104-164 kbps '
                         'MEASURED on this material).')
    ap.add_argument('--ogg', action='store_true',
                    help='Encode Ogg Vorbis instead of MP3 — smaller, and gapless '
                         'for a bed that has to loop invisibly.')
    ap.add_argument('--dry-run', action='store_true',
                    help='Report what would happen and write nothing.')
    args = ap.parse_args()

    if not os.path.isdir(SRC_DIR):
        sys.exit(f'no masters at {SRC_DIR}\n'
                 f'  the 320 kbps originals live there; this never encodes in place.')

    songs = sorted(f for f in os.listdir(SRC_DIR)
                   if f.lower().endswith(('.mp3', '.wav', '.flac', '.m4a', '.ogg')))
    if not songs:
        sys.exit(f'no audio in {SRC_DIR}')

    ext = '.ogg' if args.ogg else '.mp3'
    # ⚠️ `-f` IS EXPLICIT BECAUSE THE OUTPUT IS WRITTEN TO A `.part` NAME. ffmpeg
    # chooses its muxer from the extension, and `.mp3.part` is not one it knows:
    # every file failed with "Unable to choose an output format" until this was
    # passed. Any future change to the temp-name scheme has to keep this.
    codec = (['-codec:a', 'libvorbis', '-q:a', '3', '-f', 'ogg'] if args.ogg
             else ['-codec:a', 'libmp3lame', '-q:a', str(args.quality), '-f', 'mp3'])
    label = 'vorbis q3' if args.ogg else f'lame V{args.quality}'

    print(f'{len(songs)} song(s)   {SRC_DIR}')
    print(f'encoding as {label}, normalised to {TARGET_I} LUFS / {TARGET_TP} dBTP')
    print(f'-> {OUT_DIR}\n')
    print(f'{"":<32} {"master":>9} {"shipped":>9} {"":>6} {"LUFS in":>9} {"->":>7}')

    total_in = total_out = 0
    failed = []

    for name in songs:
        src = os.path.join(SRC_DIR, name)
        dst = os.path.join(OUT_DIR, os.path.splitext(name)[0] + ext)
        size_in = os.path.getsize(src)
        total_in += size_in

        if args.dry_run:
            m = measure(src)
            lufs = f'{float(m["input_i"]):.1f}' if m else '?'
            print(f'{name[:31]:<32} {human(size_in):>9} {"-":>9} {"":>6} {lufs:>9}')
            continue

        # PASS ONE. See measure(): loudnorm applied blind is a compressor riding
        # the programme, and applied to a measurement it is a gain calculation.
        m = measure(src)
        if not m:
            failed.append((name, 'could not measure loudness — not encoded'))
            continue
        af = (f'loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}'
              f':measured_I={m["input_i"]}:measured_TP={m["input_tp"]}'
              f':measured_LRA={m["input_lra"]}:measured_thresh={m["input_thresh"]}'
              f':offset={m["target_offset"]}:linear=true:print_format=summary')

        # ⚠️ TO A TEMP NAME AND THEN MOVED. ffmpeg opens the output before it has
        # finished reading, and a run interrupted halfway would otherwise leave a
        # truncated file sitting exactly where the manifest expects a whole one.
        tmp = dst + '.part'
        # ⚠️ loudnorm RESAMPLES TO 192 kHz internally, so the rate is forced back
        # here. Without it the encoder is handed 192k and the MP3 is either
        # rejected or written at a sample rate nothing in the game expects.
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src,
                            '-af', af, '-ar', '44100',
                            *codec, '-map_metadata', '0', tmp],
                           stderr=subprocess.PIPE)
        if r.returncode != 0 or not os.path.exists(tmp):
            failed.append((name, r.stderr.decode().strip()[:200]))
            if os.path.exists(tmp):
                os.remove(tmp)
            continue

        # ⚠️ THE DURATION IS CHECKED, AND IT IS NOT A FORMALITY. A truncated decode
        # produces a perfectly valid short file, which on a 5-minute song is the
        # one failure that looks like a success in a size table.
        d_in = probe(src, 'format=duration')
        d_out = probe(tmp, 'format=duration')
        if d_in and d_out and abs(float(d_in[0]) - float(d_out[0])) > 0.5:
            failed.append((name, f'duration moved {float(d_in[0]):.1f}s -> '
                                 f'{float(d_out[0]):.1f}s — output discarded'))
            os.remove(tmp)
            continue

        shutil.move(tmp, dst)
        size_out = os.path.getsize(dst)
        total_out += size_out
        pct = 100 * (1 - size_out / size_in)
        # ⚠️ THE OUTPUT IS RE-MEASURED, NOT ASSUMED. loudnorm reports what it
        # INTENDED; a limiter that ran out of headroom lands somewhere else, and
        # on a track that was already clipping that is the likely case.
        got = measure(dst)
        after = f'{float(got["input_i"]):.1f}' if got else '?'
        print(f'{name[:31]:<32} {human(size_in):>9} {human(size_out):>9} {pct:>5.0f}% '
              f'{float(m["input_i"]):>8.1f} {after:>7}')

    print('-' * 64)
    if args.dry_run:
        print(f'{"TOTAL (masters)":<34} {human(total_in):>10}')
        print('\ndry run — nothing written.')
        return

    if total_in:
        pct = 100 * (1 - total_out / total_in)
        print(f'{"TOTAL":<34} {human(total_in):>10} {human(total_out):>10} {pct:>6.0f}%')

    if failed:
        print('\nFAILED:')
        for name, why in failed:
            print(f'  {name}: {why}')
        sys.exit(1)

    print(f'\nmasters untouched in {os.path.relpath(SRC_DIR, ROOT)}/ (gitignored)')


if __name__ == '__main__':
    main()
