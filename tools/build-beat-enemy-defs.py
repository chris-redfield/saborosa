#!/usr/bin/env python3
"""Cut a beat 'em up VILLAIN sheet into a packed atlas + defs.

Sibling of tools/build-beat-coconut-defs.py, and most of the machinery is the
same: the sheets are ragged, not grids, so every frame is found by its own
content bbox, frames are deduped on mean absolute difference, and each one
carries an ANCHOR rather than being centred on its bbox. Read that file's
header for why any of that is the way it is.

WHY THIS IS A SECOND TOOL RATHER THAN A FLAG ON THAT ONE. These sheets have a
part the coconut does not: SMOKE. It rises off the ember, it is drawn in the
same white as the body, and it is a third of the frame's height. Everything
below exists because of it, and none of it applies to the coconut:

  * THE SMOKE IS NOT THE CHARACTER, so it must not size him. `sheets.js` scales
    a pack so its idle frame is `fighterSizePx` tall; done on the raw frame that
    makes a cigarette two thirds the height of everyone else, with a plume where
    his head should be. The defs therefore carry `bodyH` -- the idle frame's
    height WITHOUT the smoke -- and the pack scales on that instead.

  * THE SMOKE IS NOT THE BODY EITHER, so it must not move the anchor. It is
    white, and the body is white, so a colour test cannot tell them apart. What
    separates them is that the smoke is DETACHED: the body is the connected
    component containing the lowest opaque pixel, and every floating wisp and
    puff is some other component. That test needs no threshold and no palette.

  * THE FRAMES ARE TALLER THAN THEY LOOK, so the health bar needs telling.
    hud.js floats an enemy's bar above `size().h`; on the raw frame it hovers a
    plume's height over an empty patch of sky. Each frame carries `bh`, the
    body's height above its own anchor, and `size()` reports that.

THE ANCHOR IS THE BASE, NOT THE WHOLE BODY. The coconut's anchor is the
centroid of its whole body; a cigarette is a long thing that LEANS, and on the
lunging punch the top of him travels most of a body-width forward. Taking the
centroid of all of him would slide the feet backwards to pay for the lean --
the punch would visibly cost reach. So the horizontal anchor is read off the
bottom `BASE_FRAC` of him only: the part standing on the belt.

Row meanings are the illustrator's, 1-indexed as given (see SHEETS below).

Usage:  python3 tools/build-beat-enemy-defs.py cigarro

Outputs (assets-v2/beatemup-dungeon/), named to the main game's character-pack
convention so manifest.js loads them with the same two lines as every other
pack:
  <base>-game.png       packed atlas, downscaled by SCALE
  <base>-sprites.json   { scale, native, bodyH, frames:[{x,y,w,h,ax,ay,bh}],
                          anims:{name:[..]} }
"""
import json
import sys
from collections import deque

import numpy as np
from PIL import Image

OUT = 'assets-v2/beatemup-dungeon/'

# Shipped smaller than the master, same bargain as the coconut's, but measured
# on the BODY rather than the frame: he draws 137px tall (fighterSizePx) and
# this leaves the atlas about 170px of body to draw it from, so the sprite is
# always downscaled and never stretched, while the texture comes in near the
# coconut's. See PERFORMANCE.md for what happens when sheet textures get away.
SCALE = 0.49
PAD = 2            # transparent gutter between packed frames
ALPHA = 8          # alpha above this counts as content
# Both gaps are TIGHT, for the reason the coconut's cutter records: a generous
# threshold silently welds two frames into one and the counts stop matching.
# BAND_GAP is 2 here because this sheet's smoke reaches up into the row above
# and leaves a one-pixel bridge between bands on two of the rows.
BAND_GAP = 2       # empty rows tolerated inside one row band
GAP = 0            # empty columns tolerated inside one frame
SAME = 2.5         # mean abs channel difference below which two frames are one
SIZE_TOL = 2       # px of width/height difference tolerated when matching

# How many pixels of body a row needs before it counts as the bottom. Guards
# against an antialiased tail hanging one pixel below the feet and planting the
# character that much into the floor.
BODY_MIN_RUN = 6
# The fraction of the body, measured up from its feet, that counts as its BASE
# for the horizontal anchor. See the header: a leaning body must not drag its
# own feet backwards.
BASE_FRAC = 0.30
# The body's own white, for the base centroid. Excludes the tan limbs, so a
# punching arm cannot pull the feet sideways.
WHITE_TOL = 60

SHEETS = {
    # (name, human row number, expected frame count). The illustrator's list.
    'cigarro': {
        'src': 'assets-v2/beatemup-dungeon/cigarro-sprites-fim.png',
        'base': 'cigarro-beat',
        # Drawn facing RIGHT, like the coconut's sheet and unlike the main
        # game's packs. Recorded rather than assumed: getting it wrong does not
        # error, the character simply walks backwards for a whole build.
        'native': 'right',
        'rows': [
            ('idle',      1, 3),   # respirando
            ('walk',      2, 6),   # andando
            ('jump',      3, 6),   # pulando
            ('airPunch',  4, 7),   # pulando e socando
            ('combo',     5, 6),   # socando -- three wind-up/strike PAIRS
            ('hurt',      6, 2),   # apanhando; both frames cycle
            ('knockdown', 7, 6),   # cai no chao e levanta -- land, lie, rise
            ('death',     8, 8),   # morrendo
        ],
    },
}


def runs(flags, gap):
    """Contiguous True runs, merging those separated by <= gap. Inclusive."""
    out, start = [], None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append([start, i - 1])
            start = None
    if start is not None:
        out.append([start, len(flags) - 1])
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] - 1 <= gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return merged


def body_mask(opaque):
    """The character, without the smoke.

    THE TEST IS CONNECTEDNESS, NOT COLOUR, and that is the point. The smoke is
    the same white as the body, so no palette test can separate them -- but it
    floats. The body is the component containing the LOWEST opaque pixel (a
    cigarette stands on the belt; a wisp never does), and every detached wisp
    and puff is some other component and is dropped.
    """
    h, w = opaque.shape
    ys, xs = np.nonzero(opaque)
    if not len(ys):
        return opaque
    bottom = ys.max()
    seed_x = int(xs[ys == bottom][0])

    seen = np.zeros((h, w), bool)
    seen[bottom, seed_x] = True
    q = deque([(bottom, seed_x)])
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and opaque[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def anchor(tile):
    """Ground point and body height inside a tile.

    Returns (ax, ay, bh): the horizontal anchor, the ground line, and how tall
    the body is above that line -- all in tile pixels, all measured on the body
    only, with the smoke excluded by body_mask().

    `ax` is the centroid of the WHITE base -- the bottom BASE_FRAC of him, body
    white only, so neither a thrown arm (tan) nor a leaning head (black) can
    move his feet. See the header.
    """
    a = np.array(tile)
    opaque = a[:, :, 3] > ALPHA
    body = body_mask(opaque)

    per_row = body.sum(axis=1)
    solid = np.nonzero(per_row >= BODY_MIN_RUN)[0]
    if not len(solid):
        solid = np.nonzero(per_row > 0)[0]
    top, bottom = int(solid.min()), int(solid.max()) + 1

    rgb = a[:, :, :3].astype(int)
    white = body & (np.abs(rgb - 255).sum(axis=2) < WHITE_TOL)
    base_top = max(top, bottom - max(1, int(round((bottom - top) * BASE_FRAC))))
    base = white.copy()
    base[:base_top] = False
    base[bottom:] = False
    if base.sum() < 20:                 # a frame with no white base: take all of it
        base = body.copy()
        base[:base_top] = False
        base[bottom:] = False
    ys, xs = np.nonzero(base)
    return float(xs.mean()), float(bottom), float(bottom - top)


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else 'cigarro'
    spec = SHEETS.get(which)
    if not spec:
        raise SystemExit(f'unknown sheet {which!r}; have {sorted(SHEETS)}')
    rows = spec['rows']

    im = Image.open(spec['src']).convert('RGBA')
    a = np.array(im)[:, :, 3] > ALPHA

    bands = runs(a.any(axis=1), BAND_GAP)
    if len(bands) != len(rows):
        raise SystemExit(f'expected {len(rows)} rows, found {len(bands)}')

    tiles, anims = [], {}
    arrays = []                                 # np view of each packed tile

    def intern(tile):
        """Index of an equal-looking tile already packed, else pack this one.

        This is what makes the repeats free, and this sheet repeats a LOT: the
        first frames of the knockdown and death rows are the two hurt drawings
        again, so three rows share their opening.
        """
        n = np.array(tile).astype(int)
        for i, prev in enumerate(arrays):
            ph, pw = prev.shape[:2]
            if abs(ph - n.shape[0]) > SIZE_TOL or abs(pw - n.shape[1]) > SIZE_TOL:
                continue
            c = n if n.shape == prev.shape else np.array(
                tile.resize((pw, ph), Image.LANCZOS)).astype(int)
            if np.abs(prev - c).mean() < SAME:
                return i
        arrays.append(n)
        tiles.append(tile)
        return len(tiles) - 1

    for (name, human, want), (y0, y1) in zip(rows, bands):
        cols = runs(a[y0:y1 + 1].any(axis=0), GAP)
        if len(cols) != want:
            raise SystemExit(
                f'row {human} ({name}): expected {want} frames, found {len(cols)}')
        seq = []
        for (x0, x1) in cols:
            tile = im.crop((x0, y0, x1 + 1, y1 + 1))
            # Tighten vertically too: the band is as tall as its tallest pose.
            t = np.array(tile)[:, :, 3] > ALPHA
            ys = np.nonzero(t.any(axis=1))[0]
            tile = tile.crop((0, int(ys[0]), tile.width, int(ys[-1]) + 1))
            seq.append(intern(tile))
        anims[name] = seq

    # Shelf pack, as square as the ragged frames allow.
    cw = max(t.width for t in tiles) + PAD
    per = int(np.ceil(np.sqrt(len(tiles))))
    shelves, cur = [], []
    for t in tiles:
        cur.append(t)
        if len(cur) == per:
            shelves.append(cur); cur = []
    if cur:
        shelves.append(cur)

    W = cw * per
    H = sum(max(t.height for t in s) + PAD for s in shelves)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    frames, y = [], 0
    for s in shelves:
        sh = max(t.height for t in s) + PAD
        for i, t in enumerate(s):
            x = i * cw
            atlas.paste(t, (x, y))
            ax, ay, bh = anchor(t)
            frames.append({'x': x, 'y': y, 'w': t.width, 'h': t.height,
                           'ax': round(ax, 1), 'ay': round(ay, 1),
                           'bh': round(bh, 1)})
        y += sh

    # THE PACK'S REFERENCE HEIGHT, and the reason the defs carry it: the idle
    # frame is a third smoke, so sizing the pack on the frame would draw a
    # two-thirds-height cigarette under a full-height plume.
    body_h = frames[anims['idle'][0]]['bh']

    if SCALE != 1.0:
        nw, nh = int(round(W * SCALE)), int(round(H * SCALE))
        atlas = atlas.resize((nw, nh), Image.LANCZOS)
        for f in frames:
            for k in ('x', 'y', 'w', 'h'):
                f[k] = int(round(f[k] * SCALE))
            for k in ('ax', 'ay', 'bh'):
                f[k] = round(f[k] * SCALE, 1)
        body_h = round(body_h * SCALE, 1)

    base = spec['base']
    atlas.save(OUT + base + '-game.png')
    with open(OUT + base + '-sprites.json', 'w') as fh:
        json.dump({'scale': SCALE, 'native': spec['native'], 'bodyH': body_h,
                   'frames': frames, 'anims': anims}, fh, indent=1)

    slots = sum(len(v) for v in anims.values())
    print(f'{base}-game.png  {atlas.size[0]}x{atlas.size[1]}  '
          f'{len(tiles)} unique frames for {slots} slots, body {body_h}px')
    for name, human, _ in rows:
        print(f'  row {human:2d}  {name:10s} {len(anims[name]):2d} slots  '
              f'-> {anims[name]}')


if __name__ == '__main__':
    main()
