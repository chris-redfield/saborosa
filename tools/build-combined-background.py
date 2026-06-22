#!/usr/bin/env python3
"""
Build stage 3's TWO game background files straight from the high-res masters.

Masters live at the REPO ROOT (dropped there by hand), all the same size and
aligned to the same world rect:

    cor-saborosa-fundo-fim-island-01.png  - island ART on a TRANSPARENT bg
    saborosa-fundo-base-fim-back-01.png   - the flat SAND backdrop
    saborosa-fundo-base-V2.png            - the flat-colour ZONE map

Outputs (into assets/, the two files the game actually loads):

    cor-saborosa-fundo-fim-island-01-combined.png
        = island composited OVER the sand backdrop -> the single DISPLAYED
          background (full island + sand), downscaled to TARGET_W.
    saborosa-fundo-base-V2.png
        = the ZONE map, downscaled to TARGET_W with NEAREST so the flat zone
          colours stay pure (no blended border hues to misclassify).

Only resizing + an alpha composite happen here — the ART itself is untouched
(no sharpening/filtering). Re-run whenever a master changes. Building both from
the SAME masters guarantees the displayed image and the zone map stay aligned.
"""
from PIL import Image
import os

Image.MAX_IMAGE_PIXELS = None  # masters exceed PIL's default bomb guard

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ASSETS = os.path.join(ROOT, 'assets')

ISLAND = os.path.join(ROOT, 'cor-saborosa-fundo-fim-island-01.png')
SAND = os.path.join(ROOT, 'saborosa-fundo-base-fim-back-01.png')
V2 = os.path.join(ROOT, 'saborosa-fundo-base-V2.png')

OUT_BG = os.path.join(ASSETS, 'cor-saborosa-fundo-fim-island-01-combined.png')
OUT_V2 = os.path.join(ASSETS, 'saborosa-fundo-base-V2.png')

# Display resolution. 5543 keeps the proven performance footprint (~90MB decoded
# for the displayed layer); the world rect is AR-based so this never affects
# placement/zoning. Matches build-island-art.py's settled target.
TARGET_W = 5543

for p in (ISLAND, SAND, V2):
    if not os.path.exists(p):
        raise SystemExit(f'missing master at repo root: {os.path.basename(p)}')

island = Image.open(ISLAND).convert('RGBA')
sand = Image.open(SAND).convert('RGBA')
v2 = Image.open(V2).convert('RGB')

if not (island.size == sand.size == v2.size):
    raise SystemExit(f'master size mismatch: island {island.size}, sand {sand.size}, v2 {v2.size}')

tw = TARGET_W
th = round(island.height * tw / island.width)

# DISPLAYED background: island OVER sand, both Lanczos-downscaled.
island_s = island.resize((tw, th), Image.LANCZOS)
sand_s = sand.resize((tw, th), Image.LANCZOS)
combined = Image.alpha_composite(sand_s, island_s)
combined.save(OUT_BG)
print(f'wrote {OUT_BG}')
print(f'  {combined.size}  {os.path.getsize(OUT_BG) / 1048576:.2f}MB')

# ZONE map: nearest-neighbour downscale keeps the flat zone colours pure.
v2_s = v2.resize((tw, th), Image.NEAREST)
v2_s.save(OUT_V2)
print(f'wrote {OUT_V2}')
print(f'  {v2_s.size}  {os.path.getsize(OUT_V2) / 1048576:.2f}MB')
