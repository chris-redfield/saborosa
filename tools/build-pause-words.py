#!/usr/bin/env python3
"""Cut the PAUSE lettering out of the artist's two word sheets.

WHAT THEY ARE. Six hand-drawn ways of saying the game is stopped -- PAUSA,
PAROU, PARADO, PARO!, ALTAS and TEMPO -- plus one SUBTITLE, `MODO SABOROSA
LIGADO`, which is the cheat's name written by hand. The pause card drew its word
as TYPE (`CONFIG.PAUSE.LINES`, Futura, 92px) and its cheat line as type under it;
both are pictures now, which is the whole reason these sheets exist. The pack is
the direct sibling of `build-gameover-words.py` and everything true there is true
here.

⚠️ TWO SHEETS, AND THE SECOND ONE OPENS WITH TWO ROWS THAT ARE NOT WORDS.
`-002.png` begins `SABOROSA APRESENTA` and `BATIDAO DE COCO` -- the game's own
front matter, drawn on the same page. Stated by the user when the sheets arrived:
*"Ignore the first 2 rows of the batidao-letter-pause-002.png file."* `SKIP` is
that instruction, and it is a COUNT OF BANDS rather than a y coordinate, so a
re-export that shifts the page still skips the right two rows.

⚠️ ONE OF THE SEVEN IS NOT A WORD, AND IT MUST NOT REACH THE SHUFFLE BAG. `MODO
SABOROSA LIGADO` is drawn small and wide, tucked 45px under PAROU on the first
sheet, and it is a CAPTION rather than a way of saying "paused" -- it appears
only while the cheat is on. It therefore leaves this tool in its OWN key, `sub`,
and NOT in `frames`: the runtime bag is `frames.length` long, so a subtitle sitting
in that list would eventually be drawn as the pause word itself. Keeping the two
roles apart in the FILE is what makes that impossible rather than merely unlikely.

⚠️ CUT ON ROW BANDS, NOT ON BODIES -- the same call the game over words and the
scenery make, for the same reason. A word is not one connected component: the
circumflex over PARO! floats, and so does the dot of its exclamation mark. The
unit is the BAND, a horizontal stripe of the sheet with ink in it, and everything
inside one band belongs to one word.

ONE SCALE FOR ALL SEVEN, which is the standing rule for a pack in this project:
never rescale sprites against each other to even them out. The artist drew
`MODO SABOROSA LIGADO` 4587px wide and `PARO!` 2486px, and that relationship --
a caption a third the height of the word above it -- is the drawing. The game
derives its one on-screen scale from the widest WORD (`PAUSE.wRel`), and the
subtitle is drawn at that same px-per-source ratio, so it lands where it was
drawn relative to them. ⚠️ THE WIDEST FRAME IN THE FILE IS THE SUBTITLE, which is
exactly why the game measures the scale over `frames` alone: hand the ratio to
the caption and every word on the card shrinks to make room for a line that is
usually not even on screen.

THE ANCHOR IS THE CENTRE, for every frame including the subtitle. These are not
standing on anything -- the card centres the word on the screen and hangs the
caption off its bottom edge, and `pause.js` does that arithmetic from centres. One
anchor rule for the pack; a frame anchored differently from its neighbours is the
kind of thing that is only found by looking at it.

  python3 tools/build-pause-words.py
  python3 tools/build-pause-words.py --scale 0.27 --dry-run
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon')
OUT  = os.path.join(SRC, 'batidao-pause-words')

# The sheets, in order, with what each band is. `skip` is how many leading bands
# are NOT part of this pack -- see the header. The names are for the report and
# the JSON; nothing reads them at runtime, the pick is by index.
SHEETS = [
    {'file': 'batidao-letter-pause-001.png', 'skip': 0,
     'names': ['PAUSA', 'PAROU', 'MODO SABOROSA LIGADO', 'PARADO']},
    # ⚠️ skip 2: `SABOROSA APRESENTA` and `BATIDAO DE COCO`. Told, not derived.
    {'file': 'batidao-letter-pause-002.png', 'skip': 2,
     'names': ['PARO!', 'ALTAS', 'TEMPO']},
]
# The one band that is a caption rather than a word. Named, not indexed, so
# reordering the sheets above cannot silently promote it into the bag.
SUB_NAME = 'MODO SABOROSA LIGADO'
GAP = 4            # transparent rows between frames in the output sheet


def bands(ink):
    """Row bands with ink in them, as (y0, y1) pairs."""
    rows, out, start = ink.any(1), [], None
    for y, v in enumerate(rows):
        if v and start is None: start = y
        if not v and start is not None:
            out.append((start, y)); start = None
    if start is not None: out.append((start, len(rows)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--scale', type=float, default=0.27,
                    help='master px -> output px. 0.27 puts the widest word at '
                         '888px against the 563px the card draws it, and the '
                         'subtitle at 1239 against 774 -- headroom for wRel to '
                         'go up without going soft.')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    crops, names = [], []
    for sh in SHEETS:
        path = os.path.join(a.src, sh['file'])
        im = Image.open(path).convert('RGBA')
        arr = np.array(im)
        # INK IS OPAQUE AND NOT WHITE -- both tests, so neither a flattened
        # export (no alpha) nor a white paper inside a letter costs a word.
        # Straight from build-gameover-words.py.
        ink = (arr[..., 3] > 16) & (arr[..., :3].astype(int).sum(2) < 720)
        raw = bands(ink)
        want = sh['skip'] + len(sh['names'])
        if len(raw) != want:
            sys.exit('%s: expected %d bands (%d skipped + %d wanted), found %d. '
                     'The sheet changed; fix SHEETS rather than the numbers here.'
                     % (sh['file'], want, sh['skip'], len(sh['names']), len(raw)))
        for (y0, y1), name in zip(raw[sh['skip']:], sh['names']):
            seg = ink[y0:y1]
            cols = np.where(seg.any(0))[0]
            crops.append(im.crop((int(cols[0]), y0, int(cols[-1]) + 1, y1)))
            names.append(name)

    if SUB_NAME not in names:
        sys.exit('%s is not in SHEETS -- the pause card has no cheat caption to '
                 'draw. Name it, or take the sub out of pause.js too.' % SUB_NAME)
    if len(names) - 1 != 6:
        sys.exit('expected 6 pause words beside the subtitle, got %d. If the '
                 'artist added one, add it to SHEETS; the bag sizes itself.'
                 % (len(names) - 1))

    k = a.scale
    small = [c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))),
                      Image.LANCZOS) for c in crops]
    sw = max(c.width for c in small)
    sh_ = sum(c.height for c in small) + GAP * (len(small) - 1)

    sheet = Image.new('RGBA', (sw, sh_), (0, 0, 0, 0))
    words, sub, y = [], None, 0
    for name, c in zip(names, small):
        sheet.paste(c, (0, y))
        f = {'name': name, 'x': 0, 'y': y, 'w': c.width, 'h': c.height,
             'ax': c.width / 2, 'ay': c.height / 2}
        if name == SUB_NAME: sub = f
        else: words.append(f)
        y += c.height + GAP

    print('%-22s %5s x %-5s' % ('frame', 'w', 'h'))
    for f in words:
        print('%-22s %5d x %-5d' % (f['name'], f['w'], f['h']))
    print('%-22s %5d x %-5d   (sub, not in the bag)' % (sub['name'], sub['w'], sub['h']))
    print('sheet %dx%d at scale %.3f' % (sw, sh_, k))
    if a.dry_run:
        return

    sheet.save(a.out + '-game.png')
    with open(a.out + '-sprites.json', 'w') as fh:
        json.dump({'scale': k, 'frames': words, 'sub': sub}, fh, indent=1)
    print('wrote %s-game.png (%d KB) and -sprites.json'
          % (a.out, os.path.getsize(a.out + '-game.png') // 1024))


main()
