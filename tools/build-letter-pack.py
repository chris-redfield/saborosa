#!/usr/bin/env python3
"""Cut the hand-lettered FRONT END out of `batidao-letter-todos.png`.

WHAT IT IS. One sheet carrying every word the game shows outside a fight: the
title and its English gloss, the three menu items, the select prompt and the two
coconut names, a row of four drawn coconuts for the lives, six fighter names for
under the health bars, the options screen with its two meters, and the credits.
Everything here used to be TYPE set in Futura, or did not exist.

⚠️ CUT ON ROW BANDS -- the sheet is a stack of lines and a line is not one
connected component. Same call `build-beat-fundo-defs.py` and
`build-gameover-words.py` make, for the same reason.

⚠️ AND THE BANDS DO NOT AGREE WITH THE LINES, WHICH IS WHY THIS IS A TABLE AND
NOT A LOOP. Three separate things go wrong, and each of them is a row of `PACK`:

  * TWO LINES BAND AS ONE. `COMEÇAR`/`OPÇÕES` and `ESCOLHA SEU COCO`/`LEBRON`
    are drawn close enough that their yellow highlight blocks touch. `rows=(n,i)`
    splits a band into n lines at its emptiest rows and takes the i-th.
    ⚠️ AND A SPLIT LEAVES CRUMBS OF THE OTHER LINE. The emptiest row is not an
    empty row: `LEBRON`'s slice came out 743px wide instead of 452 because a
    25px-tall crumb of the line above sat far to its right, and since a frame is
    placed by its BOX that crumb would have shoved LEBRON off centre on the
    select screen -- a wrong POSITION out of a stray you cannot see. So a split
    row drops column pieces under a quarter of its tallest (25px against 311).
    Only a split row: a whole line legitimately contains short pieces -- the dots
    of `...`, the É floating in the credits -- and this filter would eat them.
  * ONE LINE IS SEVERAL THINGS. The lives row is four coconuts, and each option
    row is a word followed by eight meter bars. `cols=(a,b)` takes a range of
    the band's column pieces.
  * AND ONE THING IS SEVERAL LINES. The credits are three lines and one
    sentence, so they band as one on purpose and are kept whole.

⚠️ THE OPTION ROWS CARRY `cuts` RATHER THAN EIGHT BAR FRAMES. A meter showing n
bars is the row drawn from its left edge to `cuts[n]` -- one blit at the art's
own geometry, and no code that has to re-space bars the artist already spaced.
cuts[0] is the end of the word, so an empty meter is the word alone.

⚠️ ONE SCALE FOR THE WHOLE PACK. Never rescale these against each other to even
them out: the title is 6815px wide and a fighter name is 830, and the game draws
both at the same px-per-source ratio.

  python3 tools/build-letter-pack.py --dry-run
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon/batidao-letter-todos.png')
OUT  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon/batidao-letters')

MIN_BAND_H = 8      # 1px slivers under HORÁCIO are export dust, not lines
MIN_PIECE_W = 20    # ...and the same for column pieces

# key            band  rows      cols      what it is
PACK = [
    ('title',        0, None,     None),   # BATIDÃO DE CÔCO
    ('subtitle',     1, None,     None),   # ( BIG COCONUT BASH )
    ('menuStart',    2, (2, 0),   None),   # COMEÇAR
    ('menuOptions',  2, (2, 1),   None),   # OPÇÕES
    ('menuCredits',  3, None,     None),   # SABOROSA
    ('choose',       4, (2, 0),   None),   # ESCOLHA SEU COCO
    ('pickLEBRON',   4, (2, 1),   None),   # LEBRON, over the select art
    ('pickIPANEIMA', 5, None,     None),
    ('life',         6, None,     'each'), # four drawn coconuts -> life0..life3
    ('nameIPANEIMA', 7, None,     None),   # the six under-the-bar names
    ('nameLEBRON',   8, None,     None),
    ('nameNARUTAO',  9, None,     None),
    ('nameHIPOLITO', 10, None,    None),
    ('nameHORACIO',  11, None,    None),
    ('nameMISTERSTOP', 12, None,  None),
    ('optTitle',     13, None,    None),   # OPÇÕES, as a screen heading
    ('optVolume',    14, None,    'meter'),
    ('optMusic',     15, None,    'meter'),
    ('credTitle',    16, None,    None),   # SABOROSA
    ('credNames',    17, None,    None),   # ...é Gabriel Góes e Christian Miranda
]
BARS = 8            # meter bars per option row; asserted below


def bands(ink):
    rows, out, s = ink.any(1), [], None
    for y, v in enumerate(rows):
        if v and s is None: s = y
        if not v and s is not None:
            if y - s >= MIN_BAND_H: out.append((s, y))
            s = None
    if s is not None and len(rows) - s >= MIN_BAND_H: out.append((s, len(rows)))
    return out


def pieces(col_any):
    out, s = [], None
    for x, v in enumerate(col_any):
        if v and s is None: s = x
        if not v and s is not None: out.append((s, x)); s = None
    if s is not None: out.append((s, len(col_any)))
    return [p for p in out if p[1] - p[0] >= MIN_PIECE_W]


def split_rows(ink, y0, y1, n):
    """Cut a band into n lines at its emptiest rows.

    Searched over the MIDDLE of the band only: the top and bottom rows of any
    band are nearly empty by definition, and a split there returns the band and
    an empty strip.
    """
    prof = ink[y0:y1].sum(1)
    h = len(prof)
    cuts = []
    for i in range(1, n):
        lo, hi = int(h * i / n) - h // 6, int(h * i / n) + h // 6
        lo, hi = max(1, lo), min(h - 1, hi)
        cuts.append(y0 + lo + int(np.argmin(prof[lo:hi])))
    edges = [y0] + cuts + [y1]
    return list(zip(edges[:-1], edges[1:]))


def tight(ink, im, x0, y0, x1, y1):
    """Shrink a box to the ink actually inside it."""
    seg = ink[y0:y1, x0:x1]
    ys, xs = np.where(seg.any(1))[0], np.where(seg.any(0))[0]
    return im.crop((x0 + int(xs[0]), y0 + int(ys[0]),
                    x0 + int(xs[-1]) + 1, y0 + int(ys[-1]) + 1)), \
           (x0 + int(xs[0]), y0 + int(ys[0]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SRC)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--scale', type=float, default=0.20,
                    help='master px -> pack px. 0.20 puts the title at 1363px, '
                         'wider than the game ever draws it.')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    im = Image.open(a.src).convert('RGBA')
    arr = np.array(im)
    ink = (arr[..., 3] > 16) & (arr[..., :3].astype(int).sum(2) < 720)
    B = bands(ink)
    print('bands: %d' % len(B))

    cut = []      # (key, PIL image, extra dict)
    for key, bi, rows, cols in PACK:
        if bi >= len(B):
            sys.exit('band %d for %r does not exist -- the sheet changed.' % (bi, key))
        y0, y1 = B[bi]
        if rows:
            n, i = rows
            y0, y1 = split_rows(ink, y0, y1, n)[i]
        seg = ink[y0:y1]
        ps = pieces(seg.any(0))
        if rows:
            hs = [np.ptp(np.where(seg[:, p[0]:p[1]].any(1))[0]) + 1 for p in ps]
            tall = max(hs)
            kept = [p for p, hh in zip(ps, hs) if hh >= tall * 0.25]
            if len(kept) != len(ps):
                print('   %s: dropped %d crumb(s) of the neighbouring line'
                      % (key, len(ps) - len(kept)))
            ps = kept
        if cols == 'each':
            for i, (x0, x1) in enumerate(ps):
                img, _ = tight(ink, im, x0, y0, x1, y1)
                cut.append((key + str(i), img, {}))
            continue
        if cols == 'meter':
            if len(ps) < BARS + 1:
                sys.exit('%r: expected a word plus %d bars, found %d pieces.'
                         % (key, BARS, len(ps)))
            word, bars = ps[:-BARS], ps[-BARS:]
            x0 = word[0][0]
            img, org = tight(ink, im, x0, y0, bars[-1][1], y1)
            # cuts[n] = how wide to draw for n bars, in this frame's own pixels.
            cuts = [word[-1][1] - org[0]] + [b[1] - org[0] for b in bars]
            cut.append((key, img, {'cuts': cuts}))
            continue
        img, _ = tight(ink, im, ps[0][0], y0, ps[-1][1], y1)
        cut.append((key, img, {}))

    k = a.scale
    small = [(key, img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))),
                              Image.LANCZOS), ex) for key, img, ex in cut]
    sw = max(i.width for _, i, _ in small)
    sh = sum(i.height for _, i, _ in small) + 4 * (len(small) - 1)

    sheet = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    frames, y = {}, 0
    for key, img, ex in small:
        sheet.paste(img, (0, y))
        f = {'x': 0, 'y': y, 'w': img.width, 'h': img.height}
        if 'cuts' in ex: f['cuts'] = [max(1, round(c * k)) for c in ex['cuts']]
        frames[key] = f
        print('%-16s %5d x %-4d%s' % (key, img.width, img.height,
                                      '  cuts=' + str(f['cuts']) if 'cuts' in f else ''))
        y += img.height + 4
    print('sheet %dx%d at scale %.3f' % (sw, sh, k))
    if a.dry_run: return

    sheet.save(a.out + '-game.png')
    with open(a.out + '-sprites.json', 'w') as fh:
        json.dump({'scale': k, 'frames': frames}, fh, indent=1)
    print('wrote %s-game.png (%d KB) and -sprites.json'
          % (a.out, os.path.getsize(a.out + '-game.png') // 1024))


main()
