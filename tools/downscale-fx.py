#!/usr/bin/env python3
"""
Downscale the ambient-FX sheets (assets-003) and scale their box defs to match.

The source sheets are 4960x7016 (~35 MP, ~139 MB decoded in RAM each) but the FX
draw at ~26px on screen — wildly over-resolution. This bakes a smaller sheet for
the GAME to load (cutting decode time + VRAM ~16x at F=4) while leaving the
originals untouched for tools/fx-lab.html (which detects at full res).

Outputs (originals are NOT modified):
  saborosa-assets-003-small.png        (bold,  downscaled)
  saborosa-assets-003-V2-small.png     (faint, downscaled)
  saborosa-assets-003-fx-small.json    (boxes / 4, ball frames / 4, downscale: F)

The defs gain a "downscale" field; FxManager multiplies its draw scale by it so
the on-screen size is identical to before. Re-run this after re-exporting from
fx-lab.html (the tool always writes full-res defs).
"""
import json, os
from PIL import Image

F = 4   # linear downscale factor (16x fewer pixels). Keep <= 6 to avoid upscaling.

ASSETS = os.path.join(os.path.dirname(__file__), '..', 'assets')

SHEETS = [
    ('saborosa-assets-003.png',    'saborosa-assets-003-small.png'),
    ('saborosa-assets-003-V2.png', 'saborosa-assets-003-V2-small.png'),
]
DEFS_IN  = 'saborosa-assets-003-fx.json'
DEFS_OUT = 'saborosa-assets-003-fx-small.json'


def downscale_png(src, dst):
    p = os.path.join(ASSETS, src)
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    small = im.resize((round(w / F), round(h / F)), Image.LANCZOS)
    op = os.path.join(ASSETS, dst)
    small.save(op, optimize=True)
    print(f"  {src} {im.size} ({os.path.getsize(p)//1024} KB) "
          f"-> {dst} {small.size} ({os.path.getsize(op)//1024} KB)")


def scale_box(b):
    return {'x': round(b['x'] / F), 'y': round(b['y'] / F),
            'w': round(b['w'] / F), 'h': round(b['h'] / F)}


def scale_defs():
    with open(os.path.join(ASSETS, DEFS_IN)) as fh:
        d = json.load(fh)
    d['downscale'] = F
    for r in d.get('rows', []):
        r['boxes'] = [scale_box(b) for b in r['boxes']]
    if 'animation' in d and 'frames' in d['animation']:
        d['animation']['frames'] = [scale_box(b) for b in d['animation']['frames']]
    with open(os.path.join(ASSETS, DEFS_OUT), 'w') as fh:
        json.dump(d, fh, indent=2)
    print(f"  {DEFS_IN} -> {DEFS_OUT}  (boxes /{F}, downscale:{F})")


if __name__ == '__main__':
    print(f"Downscaling FX sheets by {F}x (decoded RAM ~{F*F}x smaller):")
    for src, dst in SHEETS:
        downscale_png(src, dst)
    scale_defs()
    print("Done.")
