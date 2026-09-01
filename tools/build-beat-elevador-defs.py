#!/usr/bin/env python3
"""Cut the bookcase's ELEVATOR out of its three hand-drawn masters.

WHAT IT IS. The lift in level 3, the switchback climb of the comic-book
bookcase. It replaces the drawn trapezoid placeholder that shipped in
src/level3.js (`_drawSlab`) -- a slab in the belt's perspective, drawn rather
than illustrated, written to be thrown away the moment the real art arrived.
This is that art.

⚠️ THE THREE FILES ARE A BOIL, NOT AN ANIMATION WITH POSES. They are the same
platform drawn three times; nothing in them moves except the hand. So:

  * THEY ARE CROPPED TO ONE SHARED RECT, the union of all three, and they share
    ONE ANCHOR. Cropping each to its own bbox, or re-centring each on its own
    front edge, would cancel exactly the wobble the three drawings exist to
    produce -- the frames would line up perfectly and the boil would vanish.
    They were drawn in register in one 5525x3129 canvas; keep them there.
  * FRAME 0 IS `coconut-elevador-01` AND THAT MATTERS. A parked lift shows frame
    0 only and does not boil; the cycle runs while it is rising. So the source
    ORDER is load-bearing and not just a list. See level3.js `_liftFrame`.

⚠️ EACH MASTER CARRIES ONE STRAY 4px SPECK, at a different x in each file (3830,
4275, 1400) and a few px above the slab. A plain `getbbox()` takes them and the
crop gains ~10px of empty band at the top -- which lands directly on the anchor,
because the anchor is measured down from the crop. So rows and columns are kept
on the SPAN of their ink, not on whether they have any: under 20% of the widest
row is not part of a platform. Same speck-band trap the character cutter hit.

THE ANATOMY IS MEASURED, NOT DECLARED, and this is the point of the tool. The
placeholder carried the perspective as config (`backRatio`, `depthRel`,
`thickPx`) because a drawn trapezoid has to be told its shape. An illustrated one
already HAS a shape, so the numbers come out of the alpha and go in the JSON:

  frontW    the widest span -- the near lip, and the slab's nominal width
  backW     the span at the far edge; frontW/backW IS the drawn convergence
  topDepth  far edge down to the lip: the top face, what he stands on
  thick     the lip down to the bottom: the front face, what makes it a slab

level3.js sizes the whole thing off ONE knob (`CONFIG.LEVEL3.platform.widthPx`,
the drawn width of the near lip) and takes every other proportion from here, so
the drawing is never reshaped to fit a number -- the number picks a size and the
art keeps its own geometry.

THE ANCHOR IS THE FRONT LIP'S CENTRE, not bottom-centre like the mounds. The
belt puts a z at `topY + z`, and the lift's z is where its NEAR EDGE meets the
floor; the front face hangs below that line the way a fighter's body hangs above
it. Anchoring on the bottom of the image would sink it by the thickness.

Output (assets-v2/beatemup-dungeon/):
  elevador-game.png      packed atlas, three frames in a column
  elevador-sprites.json  { scale, frontW, backW, topDepth, thick, ax, ay, frames }
"""
import json
import os

import numpy as np
from PIL import Image

SRC = [
    'assets-v2/beatemup-dungeon/coconut-elevador-01.png',
    'assets-v2/beatemup-dungeon/coconut-elevador-02.png',
    'assets-v2/beatemup-dungeon/coconut-elevador-03.png',
]
OUT = 'assets-v2/beatemup-dungeon/elevador'
ALPHA = 40
SPECK = 0.20       # a row/col spanning under this fraction of the widest is dirt
PAD = 2

# ⚠️ A STORAGE SIZE, NOT THE DRAWN SIZE. What reaches the screen is set by
# `CONFIG.LEVEL3.platform.widthPx` and can be retuned without re-running this.
# All this has to do is be comfortably ABOVE the largest width that will ever be
# asked for, so the game only ever scales the atlas DOWN: 0.22 puts the near lip
# at ~1140px against a 1280 canvas, which is wider than the screen. The masters
# are 5525px, so even this is a 4.5x downscale and nothing is ever stretched.
SCALE = 0.22


def spans(mask):
    """Per-row ink span (max x - min x), 0 for empty rows."""
    out = np.zeros(mask.shape[0], dtype=int)
    for i, row in enumerate(mask):
        xs = np.nonzero(row)[0]
        if xs.size:
            out[i] = xs.max() - xs.min() + 1
    return out


def body(mask):
    """The slab's rect, with the stray specks left outside it. See the header."""
    rs = spans(mask)
    keep = np.nonzero(rs > SPECK * rs.max())[0]
    y0, y1 = int(keep.min()), int(keep.max())
    cols = np.nonzero(mask[y0:y1 + 1].any(axis=0))[0]
    return y0, y1, int(cols.min()), int(cols.max())


def main():
    masks, images = [], []
    for path in SRC:
        if not os.path.exists(path):
            raise SystemExit(f'missing {path}')
        im = Image.open(path).convert('RGBA')
        images.append(im)
        masks.append(np.array(im)[:, :, 3] > ALPHA)

    boxes = [body(m) for m in masks]
    # ONE rect for all three -- the union. See the header on the boil.
    y0 = min(b[0] for b in boxes)
    y1 = max(b[1] for b in boxes)
    x0 = min(b[2] for b in boxes)
    x1 = max(b[3] for b in boxes)

    # The anatomy, averaged over the three drawings so no single wobble sets it.
    fw, bw, td, th, lipy, lipc = [], [], [], [], [], []
    for m, (by0, by1, _, _) in zip(masks, boxes):
        rs = spans(m)
        wide = rs.max()
        # The lip: the first row from the top that reaches the full width. Below
        # it the span stops growing, which is the front face.
        lip = int(np.nonzero(rs >= 0.995 * wide)[0].min())
        # ⚠️ `backW` IS READ JUST BELOW THE FAR EDGE, NOT ON IT. The top row is
        # where a hand-drawn line is raggedest and it disagrees wildly between
        # the three: 3753, 3459 and 2884px, which averages to a convergence of
        # 0.649 for a slab that plainly draws about 0.73. Two per cent down the
        # top face they read 3778 / 3774 / 3781 -- the same edge, measured off
        # its own fray.
        back = np.nonzero(m[by0 + max(1, int(0.02 * (lip - by0)))])[0]
        front = np.nonzero(m[lip])[0]
        fw.append(wide)
        bw.append(back.max() - back.min() + 1)
        td.append(lip - by0)
        th.append(by1 - lip)
        lipy.append(lip)
        lipc.append((front.min() + front.max()) / 2.0)

    def s(v):
        return float(np.mean(v)) * SCALE

    tiles = []
    for im in images:
        t = im.crop((x0, y0, x1 + 1, y1 + 1))
        tiles.append(t.resize((max(1, int(round(t.width * SCALE))),
                               max(1, int(round(t.height * SCALE)))),
                              Image.LANCZOS))

    W = max(t.width for t in tiles) + PAD
    H = sum(t.height + PAD for t in tiles)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    frames, y = [], 0
    for t in tiles:
        atlas.paste(t, (0, y))
        frames.append({'x': 0, 'y': y, 'w': t.width, 'h': t.height})
        y += t.height + PAD

    defs = {
        'scale': SCALE,
        'frontW': round(s(fw), 1),
        'backW': round(s(bw), 1),
        'topDepth': round(s(td), 1),
        'thick': round(s(th), 1),
        # Shared by all three frames, in crop coords: the front lip's centre.
        'ax': round((float(np.mean(lipc)) - x0) * SCALE, 1),
        'ay': round((float(np.mean(lipy)) - y0) * SCALE, 1),
        'frames': frames,
    }
    atlas.save(OUT + '-game.png')
    with open(OUT + '-sprites.json', 'w') as fh:
        json.dump(defs, fh, indent=1)

    print(f'{OUT}-game.png  {atlas.size[0]}x{atlas.size[1]}  {len(frames)} frames, '
          f'{os.path.getsize(OUT + "-game.png") / 1024:.0f} KB')
    print(f'  crop      {x1 - x0 + 1}x{y1 - y0 + 1} of the master, shared by all three')
    print(f'  frontW    {defs["frontW"]}   backW {defs["backW"]}'
          f'   (convergence {defs["backW"] / defs["frontW"]:.3f})')
    print(f'  topDepth  {defs["topDepth"]}   thick {defs["thick"]}')
    print(f'  anchor    {defs["ax"]}, {defs["ay"]}  (front lip centre)')
    print(f'  at widthPx W the top face is {defs["topDepth"] / defs["frontW"]:.4f} x W deep')


if __name__ == '__main__':
    main()
