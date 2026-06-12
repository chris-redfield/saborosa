#!/usr/bin/env python3
"""Build the DISPLAYED stage-3 island layers from the real island art.

ALL scaling happens HERE, OFFLINE. The game loads these outputs as-is and never
resizes an image at runtime (see PERFORMANCE.md) — runtime cost must stay
"draw the PNG", nothing more.

The real island art (cor-saborosa-fundo-fim-island-01.png) is the final visual
map: a detailed, mostly-transparent island registered to the same geometry as
the V2 zoning map. To get the fall-behind effect (player can walk behind the
mountain) we split it into a lower layer and an overlay layer.

We split using the V2 OVERLAY'S SOLID SILHOUETTE as the stencil — NOT the
island's own alpha, which is full of line-art gaps. This guarantees the split
line matches the zoning map's, so occlusion/zoning stay in sync. The stencil is
resized NEAREST so it stays a hard 0/255 mask and lower+overlay remain exact
complements (no semi-transparent seam at the silhouette edge).

Display resolution: TARGET_W = 4096 (≈0.29x of the original 13857px master).
Why 4096: (a) fits the ~4096px texture cap of most mobile GPUs; (b) two RGBA
layers at 4096x3011 ≈ 49MB decoded each — ~140MB resident total vs ~1.35GB at
the old 0.6x master (the no-GPU lag fix, PERFORMANCE.md R3/R4); (c) on-screen
sharpness ≈ the pre-island background everyone was happy with.

Sources are NOT modified — only the two layer outputs are written, so the
resolution can be re-tuned by editing TARGET_W and re-running.

Inputs  (assets/):
  cor-saborosa-fundo-fim-island-01.png   real island art (RGBA, transparent bg)
  saborosa-fundo-base-V2-overlay.png     solid mountain silhouette (alpha stencil)
  saborosa-fundo-base-fim-back-01.png    flat sand backdrop
Outputs (assets/):
  cor-saborosa-fundo-fim-island-01-lower.png    sand + island outside silhouette (OPAQUE)
  cor-saborosa-fundo-fim-island-01-overlay.png  island inside silhouette (transparent)
"""
import sys
import warnings
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image

A = 'assets/'
ISLAND  = A + 'cor-saborosa-fundo-fim-island-01.png'
STENCIL = A + 'saborosa-fundo-base-V2-overlay.png'
SAND    = A + 'saborosa-fundo-base-fim-back-01.png'
OUT_LOWER = A + 'cor-saborosa-fundo-fim-island-01-lower.png'
OUT_OVER  = A + 'cor-saborosa-fundo-fim-island-01-overlay.png'

# 5543 (0.4x of the original master) = the sharpness/memory compromise the user
# picked after 4096 read as "thick lines": ~1.6x in-game upscale, ~90MB decoded
# per layer (2 layers ≈ 180MB resident — still ~7.5x lighter than the old 0.6x
# setup). NOTE: exceeds the ~4096px mobile texture cap — for a mobile build,
# re-run with TARGET_W = 4096 and ship those as a separate asset set.
TARGET_W = 5543


def main():
    island_src = Image.open(ISLAND).convert('RGBA')
    w, h = island_src.size
    TARGET = (TARGET_W, round(h * TARGET_W / w))

    # Plain Lanczos resize ONLY — no sharpening or any other post-processing.
    # User rule: the art must stay exactly what was drawn; resolution (TARGET_W)
    # is the only thing this script is allowed to change about the look.
    island = island_src.resize(TARGET, Image.LANCZOS)

    isl = np.array(island)
    ia = isl[..., 3].astype(np.uint16)

    # Hard-mask stencil (NEAREST keeps it 0/255 → exact complement split).
    stencil_img = Image.open(STENCIL).convert('RGBA').getchannel('A') \
                       .resize(TARGET, Image.NEAREST)
    stencil = np.array(stencil_img).astype(np.uint16)

    over_a  = np.minimum(ia, stencil).astype(np.uint8)        # inside silhouette
    lower_a = np.minimum(ia, 255 - stencil).astype(np.uint8)  # outside silhouette

    over = isl.copy();  over[..., 3]  = over_a   # mountain — stays transparent
    lower = isl.copy(); lower[..., 3] = lower_a  # ground   — composited onto sand

    # OFFLINE compositing: flatten the sand backdrop + the lower island art into
    # ONE OPAQUE layer. At runtime we then draw just two layers (opaque lower +
    # transparent overlay) — never a separate sand blit, never a full-canvas
    # alpha blend. The overlay must stay transparent (it's drawn over the player
    # during fall-behind), so only the lower is baked.
    sand = Image.open(SAND).convert('RGBA').resize(TARGET, Image.LANCZOS)
    baked_lower = Image.alpha_composite(sand, Image.fromarray(lower, 'RGBA'))

    # IMPORTANT: save TRUECOLOR (RGBA), NOT palette/indexed ('P'). Chrome does
    # not GPU-cache indexed-PNG sources drawn to a 2D canvas — it re-decodes
    # them per drawImage (the original FPS collapse, see README "Performance").
    # ImageBitmap-at-load makes palette safe again; re-adding quantization for
    # download size is a planned, SEPARATE step (PERFORMANCE.md M1).
    baked_lower.save(OUT_LOWER, optimize=True)
    Image.fromarray(over, 'RGBA').save(OUT_OVER, optimize=True)

    print(f'target {TARGET[0]}x{TARGET[1]} ({TARGET[0]*TARGET[1]/1e6:.1f}M px, '
          f'~{TARGET[0]*TARGET[1]*4//2**20}MB decoded per layer)')
    print(f'overlay opaque frac: {(over_a > 10).mean():.3f}')
    print(f'lower   opaque frac: {(lower_a > 10).mean():.3f}')
    print('wrote', OUT_OVER)
    print('wrote', OUT_LOWER)
    return 0


if __name__ == '__main__':
    sys.exit(main())
