#!/usr/bin/env python3
"""Cut the hand-lettered FRONT END out of the artist's front-end sheets.

WHAT IT IS. One PACK carrying every word the game shows outside a fight: the
title and its English gloss, the three menu items, the select prompt and the two
coconut names, a row of four drawn coconuts for the lives, six fighter names for
under the health bars, the options screen with its two meters, and the credits.
Everything here used to be TYPE set in Futura, or did not exist.

⚠️ TWO SOURCE SHEETS, ONE PACK (2026-10-09). `batidao-letter-todos.png` is the
original delivery; `batidao-letter-musica-002.png` arrived later with the music
credit and the soundtrack's titles on it. They are cut into the SAME atlas and
the SAME json, and `SHEETS` below is the only place that knows there are two.

⚠️⚠️ THAT IS ONLY LEGITIMATE BECAUSE THE TWO PAGES ARE THE SAME DPI, AND IT WAS
MEASURED RATHER THAN ASSUMED. The pack has exactly one scale, derived in
letters.js from the TITLE frame's width -- so a second page drawn at a different
resolution would land every word on it at the wrong size, with nothing to say so.
The pages are different SIZES (7016x15587 against 5096x7016), which is what made
this worth checking. The test is a word whose ROLE already exists in the pack:

    OPÇÕES as a screen heading (optTitle, from todos)   580 px tall in source
    MÚSICA as a screen heading (band 2, from musica)    593 px tall in source

Within 2%. The artist drew the new heading to match the old one, so one scale
reproduces their intent on both pages. ⚠️ IF A THIRD SHEET EVER ARRIVES, RUN THAT
COMPARISON BEFORE ADDING IT -- and if it fails, the sheet needs its own pack
rather than a fudge factor here.

⚠️ CUT ON ROW BANDS -- a sheet is a stack of lines and a line is not one
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

⚠️ BAND INDICES ARE PER SHEET, so `PACK` rows carry which sheet they came from.
A row's band number means nothing without it.

  python3 tools/build-letter-pack.py --dry-run
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART  = os.path.join(ROOT, 'assets-v2/beatemup-dungeon')
OUT  = os.path.join(ART, 'batidao-letters')

# sheet tag -> file. ⚠️ ORDER IS THE ATLAS ORDER, so appending a sheet appends to
# the bottom of the atlas and does not move a single existing frame.
SHEETS = {
    'todos':  os.path.join(ART, 'batidao-letter-todos.png'),
    'musica': os.path.join(ART, 'batidao-letter-musica-002.png'),
}

MIN_BAND_H = 8      # 1px slivers under HORÁCIO are export dust, not lines
MIN_PIECE_W = 20    # ...and the same for column pieces

# key            sheet     band  rows      cols      what it is
PACK = [
    ('title',        'todos',   0, None,     None),   # BATIDÃO DE CÔCO
    ('subtitle',     'todos',   1, None,     None),   # ( BIG COCONUT BASH )
    ('menuStart',    'todos',   2, (2, 0),   None),   # COMEÇAR
    ('menuOptions',  'todos',   2, (2, 1),   None),   # OPÇÕES
    ('menuCredits',  'todos',   3, None,     None),   # SABOROSA
    ('choose',       'todos',   4, (2, 0),   None),   # ESCOLHA SEU COCO
    ('pickLEBRON',   'todos',   4, (2, 1),   None),   # LEBRON, over the select art
    ('pickIPANEIMA', 'todos',   5, None,     None),
    ('life',         'todos',   6, None,     'each'), # four coconuts -> life0..life3
    ('nameIPANEIMA', 'todos',   7, None,     None),   # the six under-the-bar names
    ('nameLEBRON',   'todos',   8, None,     None),
    ('nameNARUTAO',  'todos',   9, None,     None),
    ('nameHIPOLITO', 'todos',  10, None,     None),
    ('nameHORACIO',  'todos',  11, None,     None),
    ('nameMISTERSTOP', 'todos', 12, None,    None),
    ('optTitle',     'todos',  13, None,     None),   # OPÇÕES, as a screen heading
    ('optVolume',    'todos',  14, None,     'meter'),
    ('optMusic',     'todos',  15, None,     'meter'),
    ('credTitle',    'todos',  16, None,     None),   # SABOROSA
    ('credNames',    'todos',  17, None,     None),   # ...é Gabriel Góes e Christian Miranda

    # --- the music sheet (2026-10-09) ------------------------------------
    # ⚠️ ITS FIRST TWO BANDS ARE ONE PHRASE ON TWO LINES and they are cut as
    # two frames, not one: the credits screen rolls them in and draws each
    # line at its own place, so a single frame would be an unsplittable block.
    ('credMusic',    'musica',  0, None,     None),   # MÚSICA POR
    ('credSamuraio', 'musica',  1, None,     None),   # SAMURAIO
    # ⚠️ ONE FRAME, TWO ROLES -- the MÚSICA menu item AND the heading of the
    # screen it opens. The artist drew it once; drawing it twice in the pack
    # would be two frames that have to be kept identical by hand. (The todos
    # sheet does carry SABOROSA twice, as `menuCredits` and `credTitle` --
    # because the artist drew it twice, at two sizes.)
    ('menuMusic',    'musica',  2, None,     None),   # MÚSICA
    # The soundtrack, in the order the artist listed it. ⚠️ WHICH TRACK EACH
    # ONE NAMES IS NOT DECIDED HERE -- see CONFIG.JUKEBOX. Two of the game's
    # seven tracks are NOT on this sheet (the ZERAMENTO song and HIPÓLITO's
    # theme) and so cannot be listed; asked of the artist 2026-10-09.
    ('songArrocha',  'musica',  3, None,     None),   # ARROCHA DA SERPENTE
    ('songCoco',     'musica',  4, None,     None),   # COCO NHA NHA
    ('songCumbia',   'musica',  5, None,     None),   # CUMBIA CORAZON
    ('songDance',    'musica',  6, None,     None),   # DANCE SABOROSA
    ('songSucuri',   'musica',  7, None,     None),   # SUCURI
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


def load(path):
    """One source sheet as (image, ink mask, bands).

    ⚠️ RUN PER SHEET, AND THE BANDS ARE THAT SHEET'S. `PACK`'s band numbers are
    meaningless without knowing which sheet they index, which is why every row
    of it carries a sheet tag.
    """
    im = Image.open(path).convert('RGBA')
    arr = np.array(im)

    # ⚠️ THE NEAR-WHITE PIXELS ARE ERASED, AND THE BUG THEY CAUSED IS WORTH
    # STATING. Reported 2026-09-11: *"there is a bug with the lettering cut, the
    # word ESCOLHA comes with a small horizontal line, almost transparent, but
    # it can be seen."* It is a ruled line off the master, pure white
    # (255,255,255) at alpha 55-68, running under ESCOLHA at y 149-150 of that
    # frame.
    #
    # ⚠️ THE BANDING NEVER SAW IT, WHICH IS EXACTLY WHY IT SHIPPED. `ink` below
    # already excludes near-white (`sum < 720`), so the line could not move a
    # band or a column piece -- but `ink` is only used to FIND the frames, and
    # the crop takes raw pixels from `im`. **A mask that decides where to cut is
    # not a mask that decides what to keep**, and anything the first one ignores
    # rides along into the atlas invisible to every check in this tool.
    #
    # ⚠️ ERASING *NEAR-WHITE* AND NOT "EVERYTHING `ink` REJECTS". The ink test
    # also rejects alpha <= 16, which is the letters' own antialiasing; zeroing
    # that would harden every outline in the pack to fix one line. Near-white is
    # safe because it is never real ink here, and that was MEASURED rather than
    # assumed: in the built atlas there are 1008 near-white pixels, all of them
    # under alpha 128 and ZERO at alpha 128 or above. The pack is yellow and
    # black.
    #
    # ⚠️⚠️ ONLY THE ALPHA IS CLEARED, AND ONLY WHERE THE PIXEL IS ALREADY
    # VISIBLE. Two traps, both found by measuring instead of shipping:
    #
    #   * THE MASTER'S TRANSPARENT BACKGROUND IS WHITE. 85,284,369 of its
    #     109M pixels are (255,255,255) at alpha 0 -- so `min(rgb) >= 235`
    #     matches almost the whole page and only 12,864 of those matches are
    #     the artifact. The `alpha > 0` term is what makes this a fix for a
    #     line rather than a pass over the entire sheet.
    #   * AND RGB IS KEPT, NOT ZEROED. Transparent pixels still carry colour
    #     into a LANCZOS downscale (the resample is not premultiplied), so
    #     turning a white matte black would put a dark fringe on every letter
    #     in the pack -- a regression across eighteen bands, to fix one line.
    #     Clearing alpha alone leaves the matte exactly as the artist left it.
    # ⚠️ AND IT RUNS ON EVERY SHEET, not just the first one. That is the whole
    # reason this lives in a per-sheet function: a second source page gets the
    # same treatment without anybody remembering to ask for it.
    white = (arr[..., :3].astype(int).min(2) >= 235) & (arr[..., 3] > 0)
    if white.any():
        print('%s: erased %d visible near-white px (the ruled line off the master)'
              % (os.path.basename(path), int(white.sum())))
        arr[..., 3][white] = 0
        im = Image.fromarray(arr, 'RGBA')

    ink = (arr[..., 3] > 16) & (arr[..., :3].astype(int).sum(2) < 720)
    B = bands(ink)
    print('%s: %d bands' % (os.path.basename(path), len(B)))
    return im, ink, B


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--scale', type=float, default=0.20,
                    help='master px -> pack px. 0.20 puts the title at 1363px, '
                         'wider than the game ever draws it.')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    SRC = {tag: load(path) for tag, path in SHEETS.items()}

    cut = []      # (key, PIL image, extra dict)
    for key, tag, bi, rows, cols in PACK:
        if tag not in SRC:
            sys.exit('%r names sheet %r, which is not in SHEETS.' % (key, tag))
        im, ink, B = SRC[tag]
        if bi >= len(B):
            sys.exit('band %d for %r does not exist in %s -- the sheet changed.'
                     % (bi, key, tag))
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
