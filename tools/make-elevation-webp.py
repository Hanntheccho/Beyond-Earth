#!/usr/bin/env python3
"""Build data/elev-1080.webp from data/elev-1080.png.

Run from anywhere:  python3 tools/make-elevation-webp.py
Needs Python 3 with Pillow (built with WebP support) and NumPy.

The PNG stays the untouched source. Elevation is 16-bit, packed as
R * 256 + G - 11000 metres, so the WebP must be lossless.

What changes: ocean deeper than COAST_BAND_M that is not in a 2x2 sampling
cell with shallower water or land is set to one flat value (R=G=B=0). The
globe never shows those pixels. Water is fully transparent, the land
contours ignore it, and the coastline term in globe.js clamps water depth
at COAST_BAND_M. That clamp is what makes the change invisible, so keep the
two constants equal. This only holds while the sea level is 0 m or higher.
"""

from pathlib import Path

import numpy as np
from PIL import Image

COAST_BAND_M = 2000  # must match COAST_BAND_M in src/js/globe.js
OFFSET_M = 11000
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'elev-1080.png'
OUT = ROOT / 'data' / 'elev-1080.webp'


def dilate_cells(mask):
    """Mark every pixel that shares a bilinear 2x2 cell with a marked pixel.

    Matches the shader's sampling: x wraps around, y clamps at the poles.
    """
    out = mask.copy()
    for dy in (-1, 0, 1):
        if dy == -1:
            rows = np.vstack([mask[1:], mask[-1:]])
        elif dy == 1:
            rows = np.vstack([mask[:1], mask[:-1]])
        else:
            rows = mask
        for dx in (-1, 0, 1):
            out |= np.roll(rows, dx, axis=1)
    return out


def main():
    rgb = np.array(Image.open(SRC).convert('RGB'))
    elev = rgb[..., 0].astype(np.int32) * 256 + rgb[..., 1] - OFFSET_M
    keep = dilate_cells(elev > -COAST_BAND_M)

    flat = rgb.copy()
    flat[~keep] = 0
    flat[..., 2] = 0

    Image.fromarray(flat, 'RGB').save(OUT, 'WEBP', lossless=True, quality=100, method=6)

    back = np.array(Image.open(OUT).convert('RGB'))
    if not np.array_equal(back, flat):
        raise SystemExit(f'{OUT.name} did not round-trip exactly; is Pillow encoding lossless WebP?')

    print(f'{SRC.name}: {SRC.stat().st_size / 1024:.0f} KB -> {OUT.name}: {OUT.stat().st_size / 1024:.0f} KB')
    print(f'kept {keep.mean() * 100:.1f}% of pixels exactly, flattened {(~keep).mean() * 100:.1f}% (deep ocean)')


if __name__ == '__main__':
    main()

