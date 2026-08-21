#!/usr/bin/env python3
"""Crop and downscale a MASTER sprite sheet, in place or to a new file.

The masters in assets-v2/ are artist exports at print resolution -- the horse
boss arrived at 27329x7922 and 17MB -- and nothing needs them at that size. The
cutters read them, and what the cutters produce is what the game loads, so a
master only has to carry enough pixels that no frame is ever UPSCALED on its way
to the screen. Everything above that is repository weight.

This is a tool rather than a one-off command for the usual reason: if the artist
re-exports a sheet, the reduction has to happen again the same way. Re-run it,
do not hand-resize.

  python3 tools/shrink-master.py assets-v2/beatemup-dungeon/horse-coconutbash.png --scale 0.25
  python3 tools/shrink-master.py assets-v2/beatemup-dungeon/intro-background.jpg --max-dim 2400 --quality 88

⚠️ `--max-dim` IS USUALLY THE RIGHT KNOB FOR A PHOTO, AND 2400 IS NOT ARBITRARY.
Anything loaded through the manifest as `big` is decoded and downscaled to
`CONFIG.bigTextureCap` (2400) at load time -- so pixels past that are thrown away
by the game every single run, having been paid for in the download. The intro
background arrived 4000x3000 and 6.6MB; at 2400x1800 q88 it is 1.55MB and, at
the size the game actually draws it, indistinguishable from the original.

⚠️ IT OVERWRITES BY DEFAULT AND THE LOSS IS PERMANENT. --out writes elsewhere,
--dry-run measures and writes nothing. Check the numbers before committing to a
scale: the frame heights it prints are the ceiling on how large that character
can ever be drawn.

TWO THINGS THAT WOULD FAIL SILENTLY:

  * RESAMPLING RGBA DIRECTLY *CAN* PUT A HALO ON EVERY EDGE -- though it did
    not on the horse. A transparent pixel still carries colour, and resizing the
    four channels independently gives every edge pixel a share of colour from
    pixels that were invisible. On a sheet where that hidden colour differs from
    the art it reads as a fringe: invisible in a thumbnail, obvious once
    composited on the dark belt. So this premultiplies, resizes, and
    un-premultiplies, which makes an invisible pixel contribute exactly nothing.

    MEASURED ON THE HORSE, IT CHANGED NOTHING, and the reason is worth knowing
    before trusting the next sheet. That export carries a clean BLACK MATTE
    hugging the art -- RGB 0.5 +/- 11.7 in the 6px just outside the edges -- and
    the stray 185-grey that fills 89% of the canvas sits 40px away and beyond,
    far outside what a 4x Lanczos kernel can reach. Across all 86,349 edge
    pixels the naive and premultiplied results differ by at most 1, and no pixel
    differs by more than 8. So this is insurance, not a fix: it costs one pass
    and it is the correct operation, but do not assume it is what made a sheet
    come out clean. An export matted on WHITE, or one where the artist's colour
    layer runs past the alpha mask, is where it earns its keep.

  * LANCZOS OVERSHOOTS, and un-premultiplying divides by alpha. A ringing
    highlight next to a hard edge can land above 255 or below 0 before the
    division, and a near-zero alpha then multiplies that error up into a bright
    speck. Both ends are clamped, and the un-premultiply is guarded on alpha.

CROPPING IS SAFE HERE, AND WORTH ALMOST NOTHING. The cutters find every frame by
its own content bbox, so no downstream coordinate depends on where the art sits
in the canvas. It is done anyway because it costs nothing -- but do not expect
it to shrink the FILE: PNG already compresses a blank region to almost zero, and
on the horse sheet cropping a third of the width off saved 0.8MB of 18. The size
is the drawn pixels. The only real lever is --scale.
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None      # these are artist exports; the guard is noise


def content_box(alpha, thresh, margin):
    """Bounding box of everything visible, grown by `margin` and clamped."""
    ys, xs = np.nonzero(alpha > thresh)
    if not len(xs):
        return None
    h, w = alpha.shape
    return (max(0, int(xs.min()) - margin), max(0, int(ys.min()) - margin),
            min(w, int(xs.max()) + 1 + margin), min(h, int(ys.max()) + 1 + margin))


def resize_premultiplied(im, size):
    """Resize RGBA correctly: premultiply, resample, un-premultiply.

    See the header. Resampling RGB and A independently lets colour from fully
    transparent pixels leak into the edges of the art.
    """
    a = np.asarray(im, dtype=np.float32)
    alpha = a[:, :, 3:4] / 255.0
    premul = a[:, :, :3] * alpha

    pm = Image.fromarray(np.clip(premul, 0, 255).astype(np.uint8), 'RGB') \
              .resize(size, Image.LANCZOS)
    al = Image.fromarray(a[:, :, 3].astype(np.uint8), 'L') \
              .resize(size, Image.LANCZOS)

    pm = np.asarray(pm, dtype=np.float32)
    al = np.asarray(al, dtype=np.float32)
    # Guarded: alpha 0 means the colour is arbitrary, so leave it at zero rather
    # than dividing a rounding error by a rounding error.
    safe = np.maximum(al, 1.0)[:, :, None] / 255.0
    rgb = np.where(al[:, :, None] > 0, pm / safe, 0.0)

    out = np.zeros((size[1], size[0], 4), dtype=np.uint8)
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.clip(al, 0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def rows_of(alpha, thresh):
    """Row bands, for the report. Not used for cutting -- that is the cutters'
       job -- but the per-row frame height is the number that decides whether a
       scale is too aggressive, so it is worth printing before overwriting."""
    flags = (alpha > thresh).any(axis=1)
    out, start = [], None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(flags) - 1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('path')
    ap.add_argument('--scale', type=float,
                    help='fraction of the cropped size to keep, e.g. 0.25')
    ap.add_argument('--max-dim', type=int,
                    help='scale so the longest side is this, e.g. 2400. Use for '
                         'photos; see the note about bigTextureCap.')
    ap.add_argument('--quality', type=int, default=88,
                    help='JPEG/WebP quality (default 88). Ignored for PNG.')
    ap.add_argument('--out', help='write here instead of overwriting `path`')
    ap.add_argument('--margin', type=int, default=8,
                    help='transparent px kept around the content (default 8)')
    ap.add_argument('--alpha', type=int, default=8,
                    help='alpha above which a pixel counts as content')
    ap.add_argument('--no-crop', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if (args.scale is None) == (args.max_dim is None):
        sys.exit('give exactly one of --scale or --max-dim')
    if args.scale is not None and not (0 < args.scale <= 1):
        sys.exit('--scale must be in (0, 1]')
    if not os.path.exists(args.path):
        sys.exit(f'missing {args.path}')

    before_bytes = os.path.getsize(args.path)
    src = Image.open(args.path)
    # A PHOTO HAS NO ALPHA, and forcing one on costs a third more pixels for a
    # channel that is all 255 -- and would make a JPEG unsaveable. The alpha
    # crop and the premultiplied resize only mean anything on a cut-out.
    has_alpha = src.mode in ('RGBA', 'LA') or 'transparency' in src.info
    im = src.convert('RGBA') if has_alpha else src.convert('RGB')
    print(f'{args.path}')
    print(f'  in   {im.size[0]}x{im.size[1]}  {before_bytes / 1e6:.2f} MB')

    alpha = np.asarray(im)[:, :, 3] if has_alpha else None
    if has_alpha and not args.no_crop:
        box = content_box(alpha, args.alpha, args.margin)
        if box is None:
            sys.exit('nothing visible in this image')
        if box != (0, 0, im.width, im.height):
            im = im.crop(box)
            print(f'  crop {im.size[0]}x{im.size[1]}  '
                  f'(dropped {box[0]}L {box[1]}T '
                  f'{alpha.shape[1] - box[2]}R {alpha.shape[0] - box[3]}B)')

    scale = args.scale if args.scale is not None else \
        min(1.0, args.max_dim / max(im.width, im.height))

    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    if scale == 1.0:
        out = im
    elif has_alpha:
        out = resize_premultiplied(im, size)
    else:
        # No alpha, so nothing can bleed out of it: a plain resample is correct
        # and there is no premultiply to undo.
        out = im.resize(size, Image.LANCZOS)
    print(f'  out  {size[0]}x{size[1]}  at scale {round(scale, 4)}')

    if has_alpha:
        rows = rows_of(np.asarray(im)[:, :, 3], args.alpha)
        print(f'  {len(rows)} row bands; frame heights become '
              + ', '.join(str(round((b - a + 1) * scale)) for a, b in rows) + ' px')
        print('  ^ that is the CEILING on how large this character can be drawn '
              'without upscaling')

    if args.dry_run:
        print('  dry run, nothing written')
        return

    dest = args.out or args.path
    ext = os.path.splitext(dest)[1].lower()
    if ext in ('.jpg', '.jpeg'):
        out.save(dest, 'JPEG', quality=args.quality, optimize=True, progressive=True)
    elif ext == '.webp':
        out.save(dest, 'WEBP', quality=args.quality, method=6)
    else:
        out.save(dest, optimize=True)
    after = os.path.getsize(dest)
    print(f'  wrote {dest}  {after / 1e6:.2f} MB  '
          f'({before_bytes / after:.1f}x smaller)')


if __name__ == '__main__':
    main()
