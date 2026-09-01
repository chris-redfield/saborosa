#!/usr/bin/env python3
"""Cut the GAME OVER phrases out of the artist's word sheet.

WHAT THEY ARE. Seven hand-drawn ways of saying you lost -- VIIISH..., OH NAO!,
JA ERA!, PERDEU!, DETONADO, CAIU PRA FORA... and CAPO-TOU! -- one per row of
`batidao-letter-game over-001.png`. The game over panel drew the word as TYPE
(Futura, `RESULTS.LABELS.lost`); it now picks one of these pictures at random,
which is the whole reason the sheet exists.

⚠️ CUT ON ROW BANDS, NOT ON BODIES -- the same call `build-beat-fundo-defs.py`
makes and for the same reason. A phrase is not one connected component: `OH
NAO!` is nine of them and the tilde is a tenth, floating. The unit is the BAND,
a horizontal stripe of the sheet with ink in it, and everything inside one band
belongs to one phrase.

⚠️ AND ONE PHRASE IS TWO BANDS. `CAPO-` and `TOU!` are drawn on separate lines
with clear white between them, so they band as two -- and they are ONE phrase,
hyphenated across a line break exactly as it would be in a comic. Stated by the
user when the sheet arrived: *"the last row, is actually broken in two rows, that
is on purpose, the CAPO-TOU, ok? that is a single row."* MERGE says which raw
bands to join, and the tool asserts the final count, so a re-export that gains or
loses a line fails HERE rather than shipping half a word to the screen.

ONE SCALE FOR ALL SEVEN, which is the standing rule for a pack in this project:
never rescale sprites against each other to even them out. The illustrator drew
`CAIU PRA FORA...` 5171px wide and `VIIISH...` 2705px, and that difference is the
joke -- the long one fills the screen and the short one does not. The game
derives its one on-screen scale from the WIDEST frame (`GAME_OVER.title.wRel`),
so every other phrase lands at whatever size it was drawn relative to that.

THE ANCHOR IS THE CENTRE. These are not standing on anything: the panel centres
the phrase on the screen, so the point it is placed by is its middle.

  python3 tools/build-gameover-words.py
  python3 tools/build-gameover-words.py --scale 0.28 --dry-run
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon/batidao-letter-game over-001.png')
OUT  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon/batidao-gameover-words')

# The words, in sheet order -- names are for the report and the JSON, nothing
# reads them at runtime. The pick is by index.
NAMES = ['VIIISH...', 'OH NAO!', 'JA ERA!', 'PERDEU!', 'DETONADO',
         'CAIU PRA FORA...', 'CAPO-TOU!']
# Raw bands to join into one phrase, by raw index. See the header.
MERGE = [(6, 7)]
GAP   = 4          # transparent rows between frames in the output sheet


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
                    help='master px -> output px. 0.27 puts the widest phrase at '
                         '1396px, which is the widest the game can draw it.')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    im = Image.open(a.src).convert('RGBA')
    arr = np.array(im)
    # INK IS OPAQUE AND NOT WHITE. The export carries real alpha, but the paper
    # inside a letter is opaque white -- keying on alpha alone would swallow the
    # counters of the O and the D into the band and make no difference here,
    # while keying on darkness alone would find the white page if the artist
    # ever flattens the file. Both, so neither surprise costs a phrase.
    ink = (arr[..., 3] > 16) & (arr[..., :3].astype(int).sum(2) < 720)

    raw = bands(ink)
    merged, skip = [], set()
    for i, b in enumerate(raw):
        if i in skip: continue
        y0, y1 = b
        for (m0, m1) in MERGE:
            if i == m0:
                y1 = raw[m1][1]; skip.update(range(m0 + 1, m1 + 1))
        merged.append((y0, y1))

    if len(merged) != len(NAMES):
        sys.exit('expected %d phrases, found %d raw bands -> %d merged. The sheet '
                 'changed; fix NAMES/MERGE rather than the numbers here.'
                 % (len(NAMES), len(raw), len(merged)))

    crops = []
    for (y0, y1) in merged:
        seg = ink[y0:y1]
        cols = np.where(seg.any(0))[0]
        crops.append(im.crop((int(cols[0]), y0, int(cols[-1]) + 1, y1)))

    k = a.scale
    small = [c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))),
                      Image.LANCZOS) for c in crops]
    sw = max(c.width for c in small)
    sh = sum(c.height for c in small) + GAP * (len(small) - 1)

    sheet = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    frames, y = [], 0
    for name, c in zip(NAMES, small):
        sheet.paste(c, (0, y))
        frames.append({'name': name, 'x': 0, 'y': y, 'w': c.width, 'h': c.height,
                       'ax': c.width / 2, 'ay': c.height / 2})
        y += c.height + GAP

    print('%-18s %5s x %-5s' % ('phrase', 'w', 'h'))
    for f in frames:
        print('%-18s %5d x %-5d' % (f['name'], f['w'], f['h']))
    print('sheet %dx%d at scale %.3f' % (sw, sh, k))
    if a.dry_run:
        return

    sheet.save(a.out + '-game.png')
    with open(a.out + '-sprites.json', 'w') as fh:
        json.dump({'scale': k, 'frames': frames}, fh, indent=1)
    print('wrote %s-game.png (%d KB) and -sprites.json'
          % (a.out, os.path.getsize(a.out + '-game.png') // 1024))


main()
