#!/usr/bin/env python3
"""Build the displayed stage-3 layers: the colored map with the new line-art
"ink" baked on top, split by the original overlay's silhouette so the ink rides
with the terrain (ground-ink under the player, mountain-ink with the overlay).

No on-disk intermediates — run this whenever the line-art source changes.

Inputs  (assets/):
  cor-saborosa-fundo-02-lower.png      colored base, lower layer
  cor-saborosa-fundo-02-overlay.png    colored base, overlay (silhouette stencil)
  saborosa-fundo-test-02.png           line-art source (black on white)
Outputs (assets/):
  cor-saborosa-fundo-02-lower-inked.png
  cor-saborosa-fundo-02-overlay-inked.png   (alpha == original overlay → zoning unchanged)
"""
import sys
import numpy as np
from PIL import Image

A = 'assets/'
COLORED_LOWER = A + 'cor-saborosa-fundo-02-lower.png'
COLORED_OVER  = A + 'cor-saborosa-fundo-02-overlay.png'
LINEART       = A + 'saborosa-fundo-test-02.png'
OUT_LOWER     = A + 'cor-saborosa-fundo-02-lower-inked.png'
OUT_OVER      = A + 'cor-saborosa-fundo-02-overlay-inked.png'


def main():
    colored_lower = Image.open(COLORED_LOWER).convert('RGBA')
    colored_over  = Image.open(COLORED_OVER).convert('RGBA')
    art = Image.open(LINEART).convert('RGB')

    if not (colored_lower.size == colored_over.size == art.size):
        print(f"ERROR size mismatch: {colored_lower.size} {colored_over.size} {art.size}")
        return 1

    stencil = np.array(colored_over.getchannel('A'))        # 0/255 mountain silhouette
    rgb = np.array(art).astype(np.int32)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    ink_a = np.clip(255 - lum, 0, 255).astype(np.uint8)     # darkness → opacity

    def ink_layer(alpha):
        out = np.zeros((*alpha.shape, 4), np.uint8)         # black RGB
        out[..., 3] = alpha
        return Image.fromarray(out, 'RGBA')

    over_ink  = ink_layer(np.minimum(ink_a, stencil))       # ink inside silhouette
    lower_ink = ink_layer(np.minimum(ink_a, 255 - stencil)) # ink outside silhouette

    Image.alpha_composite(colored_over,  over_ink).save(OUT_OVER)
    Image.alpha_composite(colored_lower, lower_ink).save(OUT_LOWER)

    # Sanity: baked overlay alpha must equal the original silhouette.
    baked_a = np.array(Image.open(OUT_OVER).convert('RGBA').getchannel('A'))
    print('overlay alpha == original silhouette:', np.array_equal(baked_a, stencil))
    print('wrote', OUT_LOWER)
    print('wrote', OUT_OVER)
    return 0


if __name__ == '__main__':
    sys.exit(main())
