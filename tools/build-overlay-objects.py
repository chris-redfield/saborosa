#!/usr/bin/env python3
"""
build-overlay-objects.py — turn a baked overlay layer back into discrete objects.

The new map ships nature as flat full-map PNGs (assets-v2/mapa/), but the engine
needs the trees/holes as SEPARATE objects so each one depth-sorts against the
player (whole-object pass-behind, like the old hand-placed assets) and can carry
a collision box. A single baked image has no per-object info, so we recover it
here: find every connected opaque blob (one per tree/plant/hole) via ImageMagick
connected-components, and emit a placements JSON the game spawns as OverlayObjects.

Coordinates are stored NORMALISED (0..1 of the image) so they're independent of
the layer's pixel resolution — the game maps them onto the stage's world rect.

Output: assets-v2/mapa/overlay-objects.json
Re-run whenever an overlay layer changes.
"""
import json
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MAPA = os.path.join(ROOT, 'assets-v2', 'mapa')
OUT = os.path.join(MAPA, 'overlay-objects.json')

# (logical name, file, game image key, collide?, default footprint box)
# Footprint is normalised to each object's OWN bbox (base-centred). Holes don't
# collide yet — their special "fall in" logic comes later — but we still emit a
# box so it's one flag flip to enable.
# (name, file, game-key, collide, footprint, top)
#   top=False → depth-sorted object (trees/holes), interleaves with the player.
#   top=True  → "always on top" object (structures), drawn over everything as a
#               handful of discrete crops instead of a full-map blit per frame
#               (big CPU/software-render win — most of the sheet is transparent).
LAYERS = [
    ('arvores',       'saborosa-elementos-arvores.png',       'stage3_ovl_arvores',     True,
     {'offX': 0.30, 'offY': 0.82, 'w': 0.40, 'h': 0.16}, False),
    ('buracos',       'saborosa-elementos-buracos.png',       'stage3_ovl_buracos',     False,
     {'offX': 0.15, 'offY': 0.30, 'w': 0.70, 'h': 0.50}, False),
    ('estruturas-01', 'saborosa-elementos-estruturas-01.png', 'stage3_ovl_estruturas1', False,
     {'offX': 0.20, 'offY': 0.80, 'w': 0.60, 'h': 0.18}, True),
    ('estruturas-02', 'saborosa-elementos-estruturas-02.png', 'stage3_ovl_estruturas2', False,
     {'offX': 0.20, 'offY': 0.80, 'w': 0.60, 'h': 0.18}, True),
]

AREA_MIN = 350  # px — drop specks/anti-alias noise; keeps whole trees/plants

# verbose line: "  3: 169x277+1061+770 1139.8,944.5 15360 gray(255)"
LINE = re.compile(
    r'^\s*\d+:\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+[\d.]+,[\d.]+\s+(\d+)\s+(\S+)')


def blobs(png_path):
    out = subprocess.run([
        'convert', png_path, '-alpha', 'extract', '-threshold', '20%',
        '-define', 'connected-components:verbose=true',
        '-define', f'connected-components:area-threshold={AREA_MIN}',
        '-define', 'connected-components:exclude-header=true',
        '-connected-components', '8', 'null:'
    ], capture_output=True, text=True, check=True).stdout
    found = []
    for line in out.splitlines():
        m = LINE.match(line)
        if not m:
            continue
        w, h, x, y, area, color = m.groups()
        if 'gray(255)' not in color:      # opaque object only (skip background)
            continue
        if int(area) < AREA_MIN:
            continue
        found.append((int(x), int(y), int(w), int(h)))
    return found


def main():
    objects = []
    img_w = img_h = None
    for name, fname, key, collide, col, top in LAYERS:
        path = os.path.join(MAPA, fname)
        if not os.path.exists(path):
            print(f'skip (missing): {fname}')
            continue
        dims = subprocess.run(['identify', '-format', '%w %h', path],
                              capture_output=True, text=True, check=True).stdout.split()
        iw, ih = int(dims[0]), int(dims[1])
        img_w, img_h = iw, ih
        bs = blobs(path)
        for (x, y, w, h) in bs:
            objects.append({
                'sheet': key,
                'kind': name,
                'nx': round(x / iw, 6), 'ny': round(y / ih, 6),
                'nw': round(w / iw, 6), 'nh': round(h / ih, 6),
                'col': col,
                'collide': collide,
                'top': top,
            })
        print(f'{name}: {len(bs)} objects' + (' [top]' if top else ''))

    data = {'imageW': img_w, 'imageH': img_h, 'objects': objects}
    with open(OUT, 'w') as f:
        json.dump(data, f, indent=1)
    print(f'wrote {OUT}  ({len(objects)} objects total)')


if __name__ == '__main__':
    main()
