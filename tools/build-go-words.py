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

⚠️ AND SINCE 2026-09-16 EACH FRAME ALSO SAYS WHERE ITS POINTER STARTS. The
prompt is drawn as ONE blit everywhere in the game except the bookcase's middle
shelf, which is walked LEFTWARDS: there the hand has to point the other way, and
*"voce nao pode flipar a imagem diretamente, porque senao vai quebrar o texto,
pode flipar somente a mao"* -- mirroring the band would mirror the lettering with
it. So the cut writes two more numbers per frame:

    px   the pointer's left edge, in output px: the first column of the
         RIGHTMOST piece of the drawing
    tw   the words' width, in output px: up to the last column of ink BEFORE
         that gap, with the gap itself trimmed off

Both are measured on the MASTER and scaled, so they carry the master's precision
rather than the atlas's. The runtime blits [0, tw) and [px, w) as two pictures
when it needs to mirror one of them, and `w - px + (px - tw) + tw == w` -- the
mirrored prompt occupies exactly the span the single blit does. ⚠️ THE GAP
BETWEEN THE TWO IS PART OF THE LAYOUT and is why `tw` exists at all: without it
the trailing whitespace ends up on the far side and the fist lands against the
letters.

⚠️ THE SPLIT IS THE LAST GAP, NOT "THE BIGGEST" AND NOT A FRACTION OF THE WIDTH.
A phrase has gaps between its words -- PRA LA' has one at 42% and ANDA LOGO! at
40% -- and two of the five pointers are narrower than a word (the solid arrows,
15-24% of the band, against the fists' 41-46%). Only "the rightmost piece" is
true of all five, which is also the one thing the artist did consistently.

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

# ⚠️ HOW WIDE A TRANSPARENT COLUMN RUN HAS TO BE TO COUNT AS THE SEAM BEFORE THE
# POINTER, in MASTER px on a 7357px-wide sheet. Measured, the five seams are 30 /
# 188 / 174 / 184 / 122 px and the widest run that is NOT one (inside `POR AQUI!`,
# between the I and its exclamation mark) is 28 -- so the floor sits in a gap that
# only PRA LA' comes near, and PRA LA' is the phrase whose pointer is a small
# arrow drawn close to the apostrophe. 8 is well under both.
# ⚠️ AND THE SPLIT OF EVERY FRAME IS PRINTED, for the same reason dropped bands
# are: this number cannot be checked by the code, only by a human reading the
# percentages and knowing which phrases carry a fist and which carry an arrow.
MIN_POINTER_GAP = 8
# What share of a band the pointer may be, as a sanity range. The five measure
# 0.154 (arrow) to 0.457 (fist); anything outside this means the seam was found
# between two WORDS and the prompt would be cut in half at runtime.
POINTER_SHARE = (0.08, 0.60)


def pointer_split(occ):
    """Where the pointer starts and where the words end, in master px.

    `occ` is the band's column occupancy. Returns (px, tw) as the end and the
    start of the LAST transparent run at least MIN_POINTER_GAP wide.
    """
    runs, start = [], None
    for i, v in enumerate(occ):
        if not v:
            if start is None:
                start = i
        elif start is not None:
            runs.append((start, i))
            start = None
    # A trailing run cannot be the seam: there is no pointer after it.
    runs = [r for r in runs if r[1] - r[0] >= MIN_POINTER_GAP]
    if not runs:
        return None, None
    tw, px = runs[-1]
    return px, tw


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

    crops, names, splits = [], [], []
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
            x0, x1 = int(cols[0]), int(cols[-1]) + 1
            crops.append(im.crop((x0, y0, x1, y1)))
            names.append(name)
            # ⚠️ ON THE MASTER, NOT ON THE RESIZED CROP. A 0.15 downscale closes
            # PRA LA''s 30px seam to 4px of soft alpha, which is under any
            # threshold worth having -- the same reason every other measurement
            # in this project is taken before the resize.
            px, tw = pointer_split(seg[:, x0:x1].any(0))
            if px is None:
                sys.exit('%s: no pointer seam in %r (no transparent run >= %d '
                         'px). The phrase and its pointer touch, or the sheet '
                         'changed.' % (sh['file'], name, MIN_POINTER_GAP))
            splits.append((px, tw, x1 - x0))

    k = a.scale
    small = [c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))),
                      Image.LANCZOS) for c in crops]
    sw = max(c.width for c in small)
    sh_ = sum(c.height for c in small) + GAP * (len(small) - 1)

    sheet = Image.new('RGBA', (sw, sh_), (0, 0, 0, 0))
    frames, y = [], 0
    for name, c, (mpx, mtw, mw) in zip(names, small, splits):
        sheet.paste(c, (0, y))
        # THE SPLIT, CARRIED OVER FROM THE MASTER at this crop's own ratio --
        # `c.width / mw` rather than `k`, so a rounded resize cannot drift the
        # seam off the picture. Clamped inside the frame: the mirrored layout
        # needs both pieces to be at least a pixel wide.
        r = c.width / float(mw)
        px = min(c.width - 1, max(1, int(round(mpx * r))))
        tw = min(px, max(1, int(round(mtw * r))))
        # ⚠️ ANCHORED AT THE RIGHT EDGE, MID-HEIGHT -- see the header. The
        # pointer lives at the right-hand end of every band, and it is the part
        # that must land in the same place whichever phrase is dealt.
        frames.append({'name': name, 'x': 0, 'y': y, 'w': c.width, 'h': c.height,
                       'ax': c.width, 'ay': c.height / 2, 'px': px, 'tw': tw})
        y += c.height + GAP

    print('%-12s %5s x %-5s  %6s %6s %7s' % ('frame', 'w', 'h', 'words', 'ptr',
                                             'ptr %'))
    bad = []
    for f in frames:
        share = (f['w'] - f['px']) / float(f['w'])
        if not (POINTER_SHARE[0] <= share <= POINTER_SHARE[1]):
            bad.append((f['name'], share))
        print('%-12s %5d x %-5d  %6d %6d %6.1f%%'
              % (f['name'], f['w'], f['h'], f['tw'], f['w'] - f['px'],
                 share * 100))
    if bad:
        sys.exit('pointer share out of range %s: %s. The seam was found between '
                 'two WORDS -- the prompt would be cut in half when it mirrors.'
                 % (POINTER_SHARE, bad))
    print('sheet %dx%d at scale %.3f  (%d frames)' % (sw, sh_, k, len(frames)))
    if a.dry_run:
        return

    sheet.save(a.out + '-game.png')
    with open(a.out + '-sprites.json', 'w') as fh:
        json.dump({'scale': k, 'frames': frames}, fh, indent=1)
    print('wrote %s-game.png (%d KB) and -sprites.json'
          % (a.out, os.path.getsize(a.out + '-game.png') // 1024))


main()
