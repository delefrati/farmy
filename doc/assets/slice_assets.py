#!/usr/bin/env python3
"""Slice the generated combined sheets in doc/assets into individual game
sprites under frontend/public/assets. Each sprite is located by connected-
component detection: a component is assigned to a named cell by its centroid,
and the crop box is the union of all components in that cell (so tall plants or
multi-part props like the dog house + bowl are not clipped)."""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = os.path.join(os.path.dirname(__file__))
DST = os.path.abspath(os.path.join(SRC, '..', '..', 'frontend', 'public', 'assets'))

# (filename, [(x0,y0,x1,y1 fractional, subdir, name), ...])
JOBS = [
    ('ChatGPT Image Jun 19, 2026, 11_31_52 AM (1).png', [
        (0.00, 0.0, 0.34, 1.0, 'tiles', 'tile_soil'),
        (0.34, 0.0, 0.67, 1.0, 'tiles', 'tile_grass'),
        (0.67, 0.0, 1.00, 1.0, 'tiles', 'tile_locked'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_52 AM (2).png', [
        (0.0, 0.0, 0.5, 0.5, 'crops', 'crop_strawberry_seed'),
        (0.5, 0.0, 1.0, 0.5, 'crops', 'crop_strawberry_sprout'),
        (0.0, 0.5, 0.5, 1.0, 'crops', 'crop_strawberry_small'),
        (0.5, 0.5, 1.0, 1.0, 'crops', 'crop_strawberry_ready'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_52 AM (3).png', [
        (0.0, 0.0, 0.5, 0.5, 'crops', 'crop_corn_seed'),
        (0.5, 0.0, 1.0, 0.5, 'crops', 'crop_corn_sprout'),
        (0.0, 0.5, 0.5, 1.0, 'crops', 'crop_corn_small'),
        (0.5, 0.5, 1.0, 1.0, 'crops', 'crop_corn_ready'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_53 AM (4).png', [
        (0.0, 0.0, 0.5, 0.5, 'crops', 'crop_tomato_seed'),
        (0.5, 0.0, 1.0, 0.5, 'crops', 'crop_tomato_sprout'),
        (0.0, 0.5, 0.5, 1.0, 'crops', 'crop_tomato_small'),
        (0.5, 0.5, 1.0, 1.0, 'crops', 'crop_tomato_ready'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_53 AM (5).png', [
        (0.0, 0.0, 0.5, 0.5, 'crops', 'crop_rose_seed'),
        (0.5, 0.0, 1.0, 0.5, 'crops', 'crop_rose_sprout'),
        (0.0, 0.5, 0.5, 1.0, 'crops', 'crop_rose_bud'),
        (0.5, 0.5, 1.0, 1.0, 'crops', 'crop_rose_ready'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_53 AM (6).png', [
        (0.0, 0.0, 0.5, 0.5, 'crops', 'crop_sunflower_seed'),
        (0.5, 0.0, 1.0, 0.5, 'crops', 'crop_sunflower_sprout'),
        (0.0, 0.5, 0.5, 1.0, 'crops', 'crop_sunflower_bud'),
        (0.5, 0.5, 1.0, 1.0, 'crops', 'crop_sunflower_ready'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_53 AM (7).png', [
        (0.00, 0.0, 0.34, 0.5, 'animals', 'animal_chicken'),
        (0.34, 0.0, 0.67, 0.5, 'animals', 'animal_calf_calf'),
        (0.67, 0.0, 1.00, 0.5, 'animals', 'animal_calf_heifer'),
        (0.00, 0.5, 0.58, 1.0, 'animals', 'animal_calf_cow'),
        (0.58, 0.5, 1.00, 1.0, 'animals', 'product_egg'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_53 AM (8).png', [
        (0.0, 0.0, 0.5, 0.5, 'animals', 'animal_dog'),
        (0.5, 0.0, 1.0, 0.5, 'buildings', 'building_house'),
        (0.0, 0.5, 0.5, 1.0, 'buildings', 'building_barn'),
        (0.5, 0.5, 1.0, 1.0, 'buildings', 'building_doghouse'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_53 AM (9).png', [
        (0.00, 0.0, 0.50, 0.5, 'decor', 'decor_flower_pot'),
        (0.50, 0.0, 1.00, 0.5, 'decor', 'decor_wood_sign'),
        (0.00, 0.5, 0.34, 1.0, 'ui', 'icon_coin'),
        (0.34, 0.5, 0.67, 1.0, 'ui', 'icon_water'),
        (0.67, 0.5, 1.00, 1.0, 'ui', 'icon_hoe'),
    ]),
    ('ChatGPT Image Jun 19, 2026, 11_31_54 AM (10).png', [
        (0.0, 0.0, 0.5, 1.0, 'ui', 'icon_seed'),
        (0.5, 0.0, 1.0, 1.0, 'ui', 'icon_fertilizer'),
    ]),
    # Phase 2 — buttons + panels (2 rows x 3 cols)
    ('ChatGPT Image Jun 19, 2026, 01_05_15 PM.png', [
        (0.000, 0.0, 0.333, 0.5, 'ui', 'button_green'),
        (0.333, 0.0, 0.667, 0.5, 'ui', 'button_blue'),
        (0.667, 0.0, 1.000, 0.5, 'ui', 'button_red'),
        (0.000, 0.5, 0.333, 1.0, 'ui', 'button_purple'),
        (0.333, 0.5, 0.667, 1.0, 'ui', 'panel_wood'),
        (0.667, 0.5, 1.000, 1.0, 'ui', 'panel_ribbon'),
    ]),
    # Phase 2 — tool / action icons (4x4 grid)
    ('ChatGPT Image Jun 19, 2026, 01_26_23 PM.png', [
        (0.00, 0.00, 0.25, 0.25, 'ui', 'icon_pesticide'),
        (0.25, 0.00, 0.50, 0.25, 'ui', 'icon_weed'),
        (0.50, 0.00, 0.75, 0.25, 'ui', 'icon_bug'),
        (0.75, 0.00, 1.00, 0.25, 'ui', 'icon_harvest'),
        (0.00, 0.25, 0.25, 0.50, 'ui', 'icon_sell'),
        (0.25, 0.25, 0.50, 0.50, 'ui', 'icon_gift'),
        (0.50, 0.25, 0.75, 0.50, 'ui', 'icon_popularity'),
        (0.75, 0.25, 1.00, 0.50, 'ui', 'icon_xp'),
        (0.00, 0.50, 0.25, 0.75, 'ui', 'icon_calendar'),
        (0.25, 0.50, 0.50, 0.75, 'ui', 'icon_dog'),
        (0.50, 0.50, 0.75, 0.75, 'ui', 'icon_lock'),
        (0.75, 0.50, 1.00, 0.75, 'ui', 'icon_sync'),
        (0.00, 0.75, 0.25, 1.00, 'ui', 'icon_globe'),
        (0.25, 0.75, 0.50, 1.00, 'ui', 'icon_water'),
        (0.50, 0.75, 0.75, 1.00, 'ui', 'icon_hoe'),
        (0.75, 0.75, 1.00, 1.00, 'ui', 'icon_seed'),
    ]),
    # Phase 2 — extra decorations (3x3 grid, already transparent source)
    ('decor_phase2_real_transparent.png', [
        (0.000, 0.000, 0.333, 0.333, 'decor', 'decor_tree'),
        (0.333, 0.000, 0.667, 0.333, 'decor', 'decor_pond'),
        (0.667, 0.000, 1.000, 0.333, 'decor', 'decor_well'),
        (0.000, 0.333, 0.333, 0.667, 'decor', 'decor_scarecrow'),
        (0.333, 0.333, 0.667, 0.667, 'decor', 'decor_flower_bed'),
        (0.667, 0.333, 1.000, 0.667, 'decor', 'decor_haystack'),
        (0.000, 0.667, 0.333, 1.000, 'decor', 'decor_lamp'),
        (0.333, 0.667, 0.667, 1.000, 'decor', 'decor_path_tile'),
        (0.667, 0.667, 1.000, 1.000, 'decor', 'decor_fence_post'),
    ]),
    # Phase 2 — neighbor avatars (2x2 grid, solid cyan studio background).
    # bgmode 'solid' flood-fills the flat backdrop from the borders; the golden
    # ring frames wall off each portrait's interior so the inner sky is kept.
    ('ChatGPT Image Jun 19, 2026, 03_47_04 PM.png', [
        (0.0, 0.0, 0.5, 0.5, 'ui', 'neighbor_avatar_maria'),
        (0.5, 0.0, 1.0, 0.5, 'ui', 'neighbor_avatar_joao'),
        (0.0, 0.5, 0.5, 1.0, 'ui', 'neighbor_avatar_ana'),
        (0.5, 0.5, 1.0, 1.0, 'ui', 'avatar_placeholder'),
    ], 'solid'),
]

MIN_AREA = 1200
PAD = 6


def make_alpha(arr):
    """Return a boolean foreground mask by flood-filling the baked-in light-gray
    checkerboard background inward from the image borders. White parts of sprites
    are enclosed by darker outlines, so the border flood-fill never reaches them."""
    rgb = arr[:, :, :3].astype(int)
    mx = rgb.max(2)
    mn = rgb.min(2)
    sat = mx - mn
    bright = mx
    bg_like = (sat < 22) & (bright > 205)
    labels, n = ndimage.label(bg_like)
    if n == 0:
        return np.ones(bright.shape, dtype=bool)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    background = np.isin(labels, list(border))
    return ~background


def make_alpha_solid(arr):
    """Return a boolean foreground mask for a sheet drawn on a single flat
    studio color (e.g. solid cyan). Flood-fills pixels close to the sheet's
    dominant border color inward from the edges. Sprite interiors that happen to
    share that color are kept as long as a darker outline walls them off from the
    border (the same assumption make_alpha relies on)."""
    rgb = arr[:, :, :3].astype(int)
    border_px = np.concatenate([rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]])
    bcol = np.median(border_px, axis=0)
    dist = np.abs(rgb - bcol).sum(2)
    bg_like = dist < 60
    labels, n = ndimage.label(bg_like)
    if n == 0:
        return np.ones(rgb.shape[:2], dtype=bool)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    background = np.isin(labels, list(border))
    return ~background


def main():
    for job in JOBS:
        fname, cells = job[0], job[1]
        bgmode = job[2] if len(job) > 2 else 'auto'
        path = os.path.join(SRC, fname)
        src = Image.open(path).convert('RGBA')
        W, H = src.size
        arr = np.array(src)
        # Some sheets are already exported with a real alpha channel; others have
        # a baked-in light-gray checkerboard background; a few sit on a single
        # flat studio color. Pick the matching foreground extractor.
        if bgmode == 'solid':
            fg = make_alpha_solid(arr)
        elif (arr[:, :, 3] < 16).mean() > 0.02:
            fg = arr[:, :, 3] > 32
        else:
            fg = make_alpha(arr)
        arr[:, :, 3] = np.where(fg, arr[:, :, 3], 0).astype(np.uint8)
        img = Image.fromarray(arr, 'RGBA')
        labels, n = ndimage.label(fg)
        if n == 0:
            print(f'!! no components in {fname}')
            continue
        objs = ndimage.find_objects(labels)
        comps = []  # (cy, cx, y0, x0, y1, x1, area)
        for i, sl in enumerate(objs, start=1):
            if sl is None:
                continue
            ys, xs = sl
            area = int((labels[sl] == i).sum())
            if area < MIN_AREA:
                continue
            cy = (ys.start + ys.stop) / 2
            cx = (xs.start + xs.stop) / 2
            comps.append((cy, cx, ys.start, xs.start, ys.stop, xs.stop))

        for fx0, fy0, fx1, fy1, subdir, name in cells:
            cx0, cy0, cx1, cy1 = fx0 * W, fy0 * H, fx1 * W, fy1 * H
            members = [c for c in comps if cx0 <= c[1] < cx1 and cy0 <= c[0] < cy1]
            if not members:
                print(f'!! {name}: no component found in cell')
                continue
            y0 = max(0, min(m[2] for m in members) - PAD)
            x0 = max(0, min(m[3] for m in members) - PAD)
            y1 = min(H, max(m[4] for m in members) + PAD)
            x1 = min(W, max(m[5] for m in members) + PAD)
            crop = img.crop((x0, y0, x1, y1))
            out_dir = os.path.join(DST, subdir)
            os.makedirs(out_dir, exist_ok=True)
            out = os.path.join(out_dir, name + '.png')
            crop.save(out)
            print(f'  {name}.png  {crop.size[0]}x{crop.size[1]}')


if __name__ == '__main__':
    main()
