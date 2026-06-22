#!/usr/bin/env python3
"""
Extract the eight SABOROSA glyphs from the hand-drawn title sheet and pack them
into a small transparent letters sheet for placement via tools/map-editor.html.

Source: assets/saborosa-letras-01.png (5994x3549). Its bottom row holds the word
"SABOROSA" twice — a white-fill version on the left half and a yellow-fill
version on the right half. We crop the YELLOW one (clean fill + black outline)
and segment it into 8 glyphs by the empty columns between letters.

Outputs (all in assets/):
  - saborosa-letters.png         packed yellow glyphs (transparent bg)
  - saborosa-letters-white.png   the same glyphs with the yellow fill recolored
                                 to white (the black outline is kept). The game
                                 crossfades between the two for the yellow<->white
                                 flicker, so both sheets share one coordinate set.
  - saborosa-letters-sprites.json  { sheet, assets: { <id>: {x,y,w,h,char} } }

Glyph ids preserve the word order (and its repeats) so each hand-drawn instance
stays distinct: s_0 a_1 b_2 o_3 r_4 o_5 s_6 a_7.
"""
import json
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
SRC = os.path.join(ASSETS, 'saborosa-letras-01.png')

WORD = "SABOROSA"
PAD = 8          # transparent margin packed around each glyph
GAP = 12         # gap between glyphs in the packed sheet

# Pixel classifiers (RGBA, 0..255).
def masks(a):
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    yellow = (al > 40) & (r > 150) & (g > 140) & (b < 150)
    ink = (al > 40) & (r < 100) & (g < 100) & (b < 100)
    return yellow, ink


def main():
    im = Image.open(SRC).convert('RGBA')
    a = np.asarray(im)
    H, W, _ = a.shape

    yellow, ink = masks(a)
    glyph = yellow | ink
    # Restrict to the bottom-right quadrant = the yellow "SABOROSA".
    region = np.zeros_like(glyph)
    region[int(H * 0.78):, W // 2:] = True
    glyph &= region

    ys, xs = np.where(glyph)
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()

    # Column projection -> split the word at the empty (no-glyph) gaps.
    col = glyph[y0:y1 + 1, :].sum(axis=0)
    gaps, run = [], None
    for x in range(x0, x1 + 1):
        if col[x] == 0:
            if run is None:
                run = x
        else:
            if run is not None:
                if x - run >= 20:   # ignore hairline interior gaps
                    gaps.append((run, x - 1))
                run = None
    assert len(gaps) == len(WORD) - 1, f"expected {len(WORD)-1} gaps, got {len(gaps)}"

    # Letter x-bands: from previous gap end to next gap start (clamped to word).
    edges = [x0] + [g[0] for g in gaps] + [x1 + 1]
    starts = [x0] + [g[1] + 1 for g in gaps]
    ends = [g[0] - 1 for g in gaps] + [x1]

    crops = []   # (id, char, PIL yellow image)
    for i, ch in enumerate(WORD):
        bx0, bx1 = starts[i], ends[i]
        band = glyph[:, bx0:bx1 + 1]
        bys, bxs = np.where(band)
        ty0, ty1 = bys.min(), bys.max()
        tx0, tx1 = bx0 + bxs.min(), bx0 + bxs.max()

        sub = a[ty0:ty1 + 1, tx0:tx1 + 1].copy()
        sy, si = masks(sub)
        keep = sy | si
        sub[~keep] = (0, 0, 0, 0)            # drop background -> transparent
        crops.append((f"{ch.lower()}_{i}", ch, Image.fromarray(sub, 'RGBA')))

    # Pack the glyphs in a single horizontal row.
    gw = [c[2].width + PAD * 2 for c in crops]
    gh = [c[2].height + PAD * 2 for c in crops]
    sheet_w = sum(gw) + GAP * (len(crops) - 1)
    sheet_h = max(gh)

    yellow_sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    defs = {"sheet": "saborosa-letters.png", "assets": {}}
    x = 0
    for (gid, ch, img), w, h in zip(crops, gw, gh):
        px, py = x + PAD, PAD
        yellow_sheet.paste(img, (px, py), img)
        defs["assets"][gid] = {"x": px, "y": py, "w": img.width, "h": img.height, "char": ch}
        x += w + GAP

    # White variant: recolor yellow fill -> white, keep the black outline.
    wa = np.asarray(yellow_sheet).copy()
    wy, _ = masks(wa)
    wa[wy, 0:3] = 255
    white_sheet = Image.fromarray(wa, 'RGBA')

    yellow_sheet.save(os.path.join(ASSETS, 'saborosa-letters.png'))
    white_sheet.save(os.path.join(ASSETS, 'saborosa-letters-white.png'))
    with open(os.path.join(ASSETS, 'saborosa-letters-sprites.json'), 'w') as f:
        json.dump(defs, f, indent=2)

    print(f"packed {len(crops)} glyphs -> {sheet_w}x{sheet_h}")
    for gid, d in defs["assets"].items():
        print(f"  {gid:6s} {d['w']}x{d['h']}")


if __name__ == '__main__':
    main()
