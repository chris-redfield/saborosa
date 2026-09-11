#!/usr/bin/env python3
"""Cut the TIME ATTACK lettering out of `batidao-letter-timeattack-001.png`.

WHAT IT IS. Everything the minigame puts on screen, drawn by hand in place of
the type it used to set: the two HUD labels (RODADA, MOSCAS), a slash, EVERY
NUMBER FROM 0 TO 100, a set of big digits, and six cards.

⚠️ THE NUMBERS ARE WHOLE TILES, NOT ASSEMBLED DIGITS, AND THAT IS THE ARTIST'S
DESIGN RATHER THAN A CONVENIENCE. `47` is one drawing. That is why 10..100 exist
at all -- assembling them from `4` and `7` would need only ten glyphs -- and it
is what the user said they are for: *"these small numbers should be used for 2
things: 1 the clock and 2 the number of flies that were killed."* So the clock
reads WHOLE SECONDS (the mode's `.toFixed(1)` tenth has no glyph and is gone)
and the kill counter picks a tile.

⚠️ THE BIG DIGITS ARE ASSEMBLED, WHICH IS THE OPPOSITE, and the sheet says so by
carrying only 0..9 of them. They are the card-sized numerals.

⚠️ `XX` IN A PHRASE IS A HOLE, NOT LETTERING. `RODADA XX`, `RODADA XX OK` and
`DESTRUA XX MOSCAS` are drawn with two X's where a number goes. Each is cut into
the part LEFT of the hole and the part RIGHT of it, and the gaps either side are
recorded -- so the runtime lays out `left + number + right` at the spacing the
artist drew, instead of guessing a margin. The X's themselves are thrown away.

⚠️ BANDS ARE FOUND ON INK AND PIECES ARE FILTERED BY AREA. The master carries
specks -- a 2px fleck 1789px to the right of the digits row, two more in the big
digits -- and row/column banding is blind to them: they read as extra pieces and
throw every index off. `MIN_PIECE_PX` sits in a gap three orders of magnitude
wide (the smallest real piece is 9,000+ px of ink). ⚠️ Dropped pieces are
PRINTED, so a genuinely thin glyph could not vanish in silence.

ONE SCALE FOR THE WHOLE PACK, the standing rule: never rescale sprites against
each other to even them out. A card is drawn big and a HUD number small because
that is how they were drawn.

  python3 tools/build-timeattack-words.py
  python3 tools/build-timeattack-words.py --scale 0.20 --dry-run
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon')
OUT  = os.path.join(SRC, 'batidao-timeattack')

MIN_PIECE_PX = 400     # see the header -- the specks are 2..4 px of ink
GAP = 4                # transparent px between frames in the packed atlas

# The bands, top to bottom, and what each one is. `kind`:
#   'word'    the whole band is one frame
#   'pieces'  the band's column pieces, named in order
#   'hole'    a phrase with a number slot -- see the header
BANDS = [
    {'kind': 'word',   'names': ['rodada']},
    {'kind': 'word',   'names': ['moscas']},
    {'kind': 'pieces', 'names': ['slash'] + ['n%d' % i for i in range(0, 10)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(10, 20)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(20, 30)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(30, 40)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(40, 50)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(50, 60)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(60, 70)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(70, 80)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(80, 90)]},
    {'kind': 'pieces', 'names': ['n%d' % i for i in range(90, 100)] + ['n100']},
    # RODADA XX -- the hole is the last thing on the line, so there is no right
    # half and `right` is null.
    {'kind': 'hole', 'name': 'round',    'holePieces': [1, 2]},
    {'kind': 'hole', 'name': 'roundOk',  'holePieces': [1, 2]},
    {'kind': 'word', 'names': ['vai']},
    {'kind': 'pieces', 'names': ['bX'] + ['b%d' % i for i in range(0, 10)]},
    {'kind': 'hole', 'name': 'destrua',  'holePieces': [1, 2]},
    {'kind': 'word', 'names': ['tempo']},
    {'kind': 'word', 'names': ['completo']},
]


def runs(mask):
    """Contiguous True runs in a 1-D boolean, as (lo, hi) pairs."""
    out, s = [], None
    for i, v in enumerate(mask):
        if v and s is None: s = i
        if not v and s is not None: out.append((s, i)); s = None
    if s is not None: out.append((s, len(mask)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(SRC, 'batidao-letter-timeattack-001.png'))
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--scale', type=float, default=0.24,
                    help='master px -> atlas px. 0.24 puts a card band at ~180px '
                         'of height against the ~90 the screen draws it at, and a '
                         'HUD number at 77 against ~30 -- 2x headroom either way.')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    im = Image.open(a.src).convert('RGBA')
    arr = np.array(im)
    ink = (arr[..., 3] > 16) & (arr[..., :3].astype(int).sum(2) < 720)
    B = runs(ink.any(1))
    if len(B) != len(BANDS):
        sys.exit('expected %d bands, found %d -- the sheet changed; fix BANDS '
                 'rather than the numbers here.' % (len(BANDS), len(B)))

    crops, names, holes = [], [], {}
    for spec, (y0, y1) in zip(BANDS, B):
        seg = ink[y0:y1]
        P = [r for r in runs(seg.any(0))
             if int(seg[:, r[0]:r[1]].sum()) >= MIN_PIECE_PX]
        dropped = len(runs(seg.any(0))) - len(P)
        if dropped:
            print('band y%d..%d: dropped %d speck(s) under %d px of ink'
                  % (y0, y1, dropped, MIN_PIECE_PX))

        def crop(x0, x1):
            s2 = ink[y0:y1, x0:x1]
            rr = np.where(s2.any(1))[0]
            return im.crop((x0, y0 + int(rr[0]), x1, y0 + int(rr[-1]) + 1))

        if spec['kind'] == 'word':
            crops.append(crop(P[0][0], P[-1][1])); names.append(spec['names'][0])
            continue

        if spec['kind'] == 'pieces':
            if len(P) != len(spec['names']):
                sys.exit('band y%d..%d: expected %d pieces, found %d (%s)'
                         % (y0, y1, len(spec['names']), len(P), spec['names'][0]))
            for (x0, x1), nm in zip(P, spec['names']):
                crops.append(crop(x0, x1)); names.append(nm)
            continue

        # 'hole' -- the phrase around a number slot.
        h0, h1 = spec['holePieces'][0], spec['holePieces'][-1]
        if h1 >= len(P):
            sys.exit('band y%d..%d: %r wants pieces %s of %d'
                     % (y0, y1, spec['name'], spec['holePieces'], len(P)))
        nm = spec['name']
        lx0, lx1 = P[0][0], P[h0 - 1][1]
        hx0, hx1 = P[h0][0], P[h1][1]
        crops.append(crop(lx0, lx1)); names.append(nm + 'L')
        rec = {'holeW': hx1 - hx0, 'padL': hx0 - lx1, 'padR': 0}
        if h1 + 1 < len(P):
            rx0, rx1 = P[h1 + 1][0], P[-1][1]
            crops.append(crop(rx0, rx1)); names.append(nm + 'R')
            rec['padR'] = rx0 - hx1
        holes[nm] = rec

    k = a.scale
    small = [c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))),
                      Image.LANCZOS) for c in crops]
    for nm in holes:
        for f in ('holeW', 'padL', 'padR'):
            holes[nm][f] = round(holes[nm][f] * k, 1)

    # PACKED IN ROWS, wrapping at the widest frame's own width or 2048, whichever
    # is larger -- 101 numbers in one column would be a 9000px-tall texture.
    cap = max(2048, max(c.width for c in small))
    x = y = rowh = 0
    frames, sheetW = {}, 0
    for nm, c in zip(names, small):
        if x and x + c.width > cap:
            x = 0; y += rowh + GAP; rowh = 0
        frames[nm] = {'x': x, 'y': y, 'w': c.width, 'h': c.height,
                      'ax': c.width / 2, 'ay': c.height / 2}
        x += c.width + GAP; rowh = max(rowh, c.height); sheetW = max(sheetW, x - GAP)
    sheetH = y + rowh

    sheet = Image.new('RGBA', (sheetW, sheetH), (0, 0, 0, 0))
    for nm, c in zip(names, small):
        f = frames[nm]; sheet.paste(c, (f['x'], f['y']))

    print('%-10s %5s x %-5s' % ('frame', 'w', 'h'))
    for nm in ('rodada', 'moscas', 'slash', 'n0', 'n100', 'vai', 'b0', 'bX',
               'roundL', 'roundOkL', 'roundOkR', 'destruaL', 'destruaR',
               'tempo', 'completo'):
        f = frames[nm]; print('%-10s %5d x %-5d' % (nm, f['w'], f['h']))
    print('holes: %s' % json.dumps(holes))
    print('sheet %dx%d at scale %.3f  (%d frames)' % (sheetW, sheetH, k, len(frames)))
    if a.dry_run:
        return

    sheet.save(a.out + '-game.png')
    with open(a.out + '-sprites.json', 'w') as fh:
        json.dump({'scale': k, 'frames': frames, 'holes': holes}, fh, indent=1)
    print('wrote %s-game.png (%d KB) and -sprites.json'
          % (a.out, os.path.getsize(a.out + '-game.png') // 1024))


main()
