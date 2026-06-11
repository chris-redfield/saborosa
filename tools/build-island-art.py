#!/usr/bin/env python3
"""Build the DISPLAYED stage-3 island layers from the real island art.

The real island art (cor-saborosa-fundo-fim-island-01.png) is the final visual
map: a detailed, mostly-transparent island registered to the same geometry as
the V2 zoning map. To get the fall-behind effect (player can walk behind the
mountain) we split it into a lower layer and an overlay layer.

We split using the V2 OVERLAY'S SOLID SILHOUETTE as the stencil — NOT the
island's own alpha, which is full of line-art gaps. This guarantees the split
line is byte-identical to the zoning map's, so occlusion/zoning stay in sync.
(Occlusion detection itself keeps reading the solid V2 overlay; these outputs
are display-only and may have internal gaps.)

Everything is emitted at the V2 layers' resolution (the zoning map size) so the
whole stage stays at one downscaled resolution. The flat sand backdrop and the
island source are also downscaled in place to that size.

Inputs  (assets/):
  cor-saborosa-fundo-fim-island-01.png   real island art (RGBA, transparent bg)
  saborosa-fundo-base-V2-overlay.png     solid mountain silhouette (alpha stencil)
  saborosa-fundo-base-fim-back-01.png    flat sand backdrop
Outputs (assets/):
  cor-saborosa-fundo-fim-island-01-lower.png     island outside the silhouette
  cor-saborosa-fundo-fim-island-01-overlay.png   island inside the silhouette
  (sand backdrop + island source downscaled in place to the stencil size)
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


def main():
    stencil_img = Image.open(STENCIL).convert('RGBA')
    TARGET = stencil_img.size  # match the zoning layers exactly (0.6x master)
    stencil = np.array(stencil_img.getchannel('A')).astype(np.uint16)  # 0..255

    island = Image.open(ISLAND).convert('RGBA').resize(TARGET, Image.LANCZOS)
    isl = np.array(island)
    ia = isl[..., 3].astype(np.uint16)

    over_a  = np.minimum(ia, stencil).astype(np.uint8)            # inside silhouette
    lower_a = np.minimum(ia, 255 - stencil).astype(np.uint8)      # outside silhouette

    over = isl.copy();  over[..., 3]  = over_a
    lower = isl.copy(); lower[..., 3] = lower_a

    # Palette-quantize the display layers: dense line-art ink (brown/black on
    # transparent) doesn't compress as flat-color PNG, so a 256-color octree
    # palette is near-lossless here but ~12x smaller (~13MB -> ~1MB). Alpha is
    # preserved by FASTOCTREE. (Occlusion reads the solid V2 overlay, not these,
    # so the quantized edges never affect zoning/behind-mountain.)
    def save_quant(arr, path):
        Image.fromarray(arr, 'RGBA').quantize(
            colors=256, method=Image.FASTOCTREE).save(path, optimize=True)
    save_quant(over,  OUT_OVER)
    save_quant(lower, OUT_LOWER)

    # Keep the whole stage at one resolution: downscale the flat sand backdrop
    # and the island source in place to the stencil size too.
    Image.open(SAND).convert('RGB').resize(TARGET, Image.LANCZOS).save(SAND, optimize=True)
    island.save(ISLAND, optimize=True)

    print(f'target {TARGET[0]}x{TARGET[1]}')
    print(f'overlay opaque frac: {(over_a > 10).mean():.3f}')
    print(f'lower   opaque frac: {(lower_a > 10).mean():.3f}')
    print('wrote', OUT_OVER)
    print('wrote', OUT_LOWER)
    print('downscaled in place:', SAND, '+', ISLAND)
    return 0


if __name__ == '__main__':
    sys.exit(main())
