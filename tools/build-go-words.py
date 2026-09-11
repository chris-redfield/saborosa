#!/usr/bin/env python3
"""Cut the GO prompt's lettering out of the artist's sheet.

WHAT THEY ARE. Five hand-drawn ways of saying "the way out is that way" --
PRA LÁ', VAI!, POR AQUI!, VÁ and ANDA LOGO! -- for the prompt that goes up when
an arena clears. It replaces a two-piece prompt: a hand-lettered `GO!` cut off
the title sheet by tools/build-go-glyph.py, plus the MAIN GAME's pointing hand
(assets/intro-hand.png), laid out side by side with a gap between them.

⚠️ THE POINTER IS INSIDE EVERY FRAME, AND THAT IS THE BIGGEST DIFFERENCE FROM
THE PACK IT REPLACES. Each band is drawn as one complete prompt with its own
pointer already on it -- three of them a pointing FIST, two a solid ARROW -- so
the runtime has one blit where it used to have two, and there is no gap to
tune, no second image to fail to load, and no layout to close up around a
missing piece. The arrow/fist choice is the ARTIST's, per phrase; nothing in
the code knows which a frame carries and nothing should.

⚠️ CUT ON ROW BANDS, NOT ON BODIES -- the same call build-pause-words.py and
build-gameover-words.py make, for the same reason. A phrase is not one
connected component: the accent on LÁ', the dot under VAI!'s exclamation and
the whole detached fist all float free of the letters. The unit is the BAND, a
horizontal stripe of the sheet with ink in it, and everything inside one band
belongs to one phrase.

ONE SCALE FOR ALL FIVE, which is the standing rule for a pack in this project:
never rescale sprites against each other to even them out. `POR AQUI!` is drawn
more than twice as wide as `VÁ` and that relationship is the drawing. The game
derives its single on-screen scale from the widest frame (`GO_WORDS.wRel`) and
draws every other at that same px-per-source ratio.

⚠️ THE ANCHOR IS THE RIGHT EDGE, VERTICALLY CENTRED, WHICH IS NOT WHAT THE
OTHER TWO WORD PACKS USE. They centre, because a pause card and a death panel
centre a word on the screen. This prompt is pinned to the RIGHT margin and
points at the exit, so the thing that must not move between picks is the
POINTER -- and the pointer is at the right-hand end of every frame. Anchored at
the centre instead, a long phrase and a short one would put their fists in two
different places and the prompt would appear to jump about the screen. So the
phrases grow leftward out of a fixed pointer.

  python3 tools/build-go-words.py
  python3 tools/build-go-words.py --scale 0.20 --dry-run
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon')
OUT  = os.path.join(SRC, 'batidao-go-words')

# The sheet, and what each band is, top to bottom. The names are for the report
# and the JSON; nothing reads them at runtime, the pick is by index. Stated
# rather than derived so a re-export that gains or loses a row fails HERE.
SHEETS = [
    {'file': 'batidao-letter-poraqui-001.png', 'skip': 0,
     'names': ["PRA LÁ'", 'VAI!', 'POR AQUI!', 'VÁ', 'ANDA LOGO!']},
]
GAP = 4            # transparent rows between frames in the output sheet


# ⚠️ THE MINIMUM INK A BAND MUST HAVE TO BE A PHRASE, AND THIS SHEET NEEDED IT.
# The master carries ONE stray opaque pixel at y=6278, between `VA` and `ANDA
# LOGO!` -- a scanning speck, 1 px against the smallest real phrase's 1,980,576.
# Row-banding is blind to it and reports SIX bands for five phrases, which is
# the cutter working correctly on a sheet with a fleck on it. The floor sits in
# a gap five orders of magnitude wide, so it cannot be the number that decides
# anything; the same shape as `bodyArea` in build-beat-enemy-defs.py.
# ⚠️ AND DROPPED BANDS ARE PRINTED, NOT SWALLOWED. A silent filter is how a
# genuinely thin phrase -- a lone accent, a hyphen -- would disappear with
# nothing in the log; the count check below then reports a missing WORD rather
# than the speck that caused it.
MIN_BAND_PX = 2000


def bands(ink, min_px=0):
    """Row bands with ink in them, as (y0, y1, px) triples. Thin ones dropped."""
    rows, out, start = ink.any(1), [], None
    for y, v in enumerate(rows):
        if v and start is None: start = y
        if not v and start is not None:
            out.append((start, y)); start = None
    if start is not None: out.append((start, len(rows)))
    keep, drop = [], []
    for y0, y1 in out:
        n = int(ink[y0:y1].sum())
        (keep if n >= min_px else drop).append((y0, y1, n))
    return keep, drop


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--scale', type=float, default=0.15,
                    help='master px -> output px. 0.15 puts the widest phrase '
                         '(POR AQUI!) at 899px against the ~410 the prompt '
                         'draws it at -- 2.2x headroom, the same the pause pack '
                         'carries, so wRel can go up without going soft. The '
                         'master is 7357x8114 and the whole atlas would be '
                         '5.7MB of VRAM at 0.20 for pixels nothing can show.')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    crops, names = [], []
    for sh in SHEETS:
        path = os.path.join(a.src, sh['file'])
        im = Image.open(path).convert('RGBA')
        arr = np.array(im)
        # INK IS OPAQUE AND NOT WHITE -- both tests, so neither a flattened
        # export (no alpha) nor white paper inside a letter costs a phrase.
        # Straight from build-pause-words.py.
        ink = (arr[..., 3] > 16) & (arr[..., :3].astype(int).sum(2) < 720)
        raw, specks = bands(ink, MIN_BAND_PX)
        for y0, y1, n in specks:
            print('%s: dropped a %d-px band at y %d..%d (under MIN_BAND_PX %d)'
                  % (sh['file'], n, y0, y1, MIN_BAND_PX))
        want = sh['skip'] + len(sh['names'])
        if len(raw) != want:
            sys.exit('%s: expected %d bands (%d skipped + %d wanted), found %d. '
                     'The sheet changed; fix SHEETS rather than the numbers here.'
                     % (sh['file'], want, sh['skip'], len(sh['names']), len(raw)))
        for (y0, y1, _), name in zip(raw[sh['skip']:], sh['names']):
            seg = ink[y0:y1]
            cols = np.where(seg.any(0))[0]
            crops.append(im.crop((int(cols[0]), y0, int(cols[-1]) + 1, y1)))
            names.append(name)

    k = a.scale
    small = [c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))),
                      Image.LANCZOS) for c in crops]
    sw = max(c.width for c in small)
    sh_ = sum(c.height for c in small) + GAP * (len(small) - 1)

    sheet = Image.new('RGBA', (sw, sh_), (0, 0, 0, 0))
    frames, y = [], 0
    for name, c in zip(names, small):
        sheet.paste(c, (0, y))
        # ⚠️ ANCHORED AT THE RIGHT EDGE, MID-HEIGHT -- see the header. The
        # pointer lives at the right-hand end of every band, and it is the part
        # that must land in the same place whichever phrase is dealt.
        frames.append({'name': name, 'x': 0, 'y': y, 'w': c.width, 'h': c.height,
                       'ax': c.width, 'ay': c.height / 2})
        y += c.height + GAP

    print('%-12s %5s x %-5s' % ('frame', 'w', 'h'))
    for f in frames:
        print('%-12s %5d x %-5d' % (f['name'], f['w'], f['h']))
    print('sheet %dx%d at scale %.3f  (%d frames)' % (sw, sh_, k, len(frames)))
    if a.dry_run:
        return

    sheet.save(a.out + '-game.png')
    with open(a.out + '-sprites.json', 'w') as fh:
        json.dump({'scale': k, 'frames': frames}, fh, indent=1)
    print('wrote %s-game.png (%d KB) and -sprites.json'
          % (a.out, os.path.getsize(a.out + '-game.png') // 1024))


main()
