#!/usr/bin/env python3
"""Strip-safe background remover for animation sprite-strips.

ChatGPT / DALL·E frequently "fake" transparency by painting a light-gray
checkerboard (or a flat studio color) INTO the image instead of using a real
alpha channel. The grid slicer (slice_assets.py) fixes that for contact sheets,
but it trims to connected components and would destroy a sprite-STRIP's equal
frame layout. This script removes the baked-in background while keeping the full
canvas dimensions intact, so the strip still cuts into N equal frames.

Usage:
    python3 clean_strip_bg.py <input.png> [output.png] [--mode auto|checker|solid]

If output is omitted, writes <input>_clean.png next to the input. Defaults to
auto-detecting checkerboard vs flat-color backgrounds. Already-transparent PNGs
are passed through unchanged.
"""
import argparse
import os
import numpy as np
from PIL import Image
from scipy import ndimage


def mask_checker(arr):
    """Flood-fill a baked-in light-gray checkerboard inward from the borders.
    Sprite interiors are walled off by their darker outlines, so the fill never
    leaks into the character."""
    rgb = arr[:, :, :3].astype(int)
    sat = rgb.max(2) - rgb.min(2)
    bright = rgb.max(2)
    bg_like = (sat < 22) & (bright > 205)
    return _flood_from_border(bg_like, rgb.shape[:2])


def mask_solid(arr):
    """Flood-fill a single flat studio color (e.g. magenta / cyan) inward from
    the borders."""
    rgb = arr[:, :, :3].astype(int)
    border_px = np.concatenate([rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]])
    bcol = np.median(border_px, axis=0)
    dist = np.abs(rgb - bcol).sum(2)
    bg_like = dist < 60
    return _flood_from_border(bg_like, rgb.shape[:2])


def _flood_from_border(bg_like, shape):
    labels, n = ndimage.label(bg_like)
    if n == 0:
        return np.ones(shape, dtype=bool)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    background = np.isin(labels, list(border))
    return ~background


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input')
    ap.add_argument('output', nargs='?')
    ap.add_argument('--mode', choices=['auto', 'checker', 'solid'], default='auto')
    args = ap.parse_args()

    out = args.output or f'{os.path.splitext(args.input)[0]}_clean.png'
    src = Image.open(args.input).convert('RGBA')
    arr = np.array(src)

    # Already has real transparency -> leave it alone.
    if (arr[:, :, 3] < 16).mean() > 0.02:
        print(f'{args.input}: already transparent, copying unchanged -> {out}')
        src.save(out)
        return

    if args.mode == 'checker':
        fg = mask_checker(arr)
    elif args.mode == 'solid':
        fg = mask_solid(arr)
    else:
        # Auto: a checkerboard has many near-white low-saturation pixels; a flat
        # studio color usually does not. Prefer checker when it covers a big
        # share of the border, else fall back to solid.
        rgb = arr[:, :, :3].astype(int)
        sat = rgb.max(2) - rgb.min(2)
        bright = rgb.max(2)
        checker_share = ((sat < 22) & (bright > 205)).mean()
        fg = mask_checker(arr) if checker_share > 0.15 else mask_solid(arr)

    arr[:, :, 3] = np.where(fg, arr[:, :, 3], 0).astype(np.uint8)
    Image.fromarray(arr, 'RGBA').save(out)
    kept = fg.mean() * 100
    print(f'{args.input}: removed background ({100 - kept:.0f}% cleared) -> {out}')


if __name__ == '__main__':
    main()
