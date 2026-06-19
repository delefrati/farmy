# Farmy art assets

Drop PNG sprites here. They are served at runtime from `/assets/...` (Vite `public/`).
The game loads them via the manifest in `src/game/assets/manifest.ts`. Missing files
are tolerated — the game falls back to the old shape rendering for any sprite not found.

## Style — keep every asset consistent

Generate each asset with the SAME style suffix so the set looks like one artist made it.

Style suffix (append to every prompt):

```
glossy cartoon mobile farm game asset, soft cel shading, thick clean outlines,
warm saturated colors, soft top-down 3/4 view, single object centered,
transparent background, no ground shadow, Hay Day / Happy Farm style
```

Tips:
- Generate at 1024x1024, transparent background (or remove bg with remove.bg).
- Keep the style/seed fixed across all generations.
- Trim to content, export PNG with the EXACT file name below.

## Required files (file name -> what to draw)

### Tiles (`tiles/`)
- `tile_soil.png` — a square of brown tilled farm soil
- `tile_grass.png` — a square grassy ground tile
- `tile_locked.png` — a dark locked/overgrown plot with a padlock

### Crops (`crops/`) — 4 stages each: seed, sprout, small (or bud for flowers), ready
- `crop_strawberry_seed.png` / `_sprout.png` / `_small.png` / `_ready.png` — strawberry plant
- `crop_corn_seed.png` / `_sprout.png` / `_small.png` / `_ready.png` — corn plant
- `crop_tomato_seed.png` / `_sprout.png` / `_small.png` / `_ready.png` — tomato plant
- `crop_rose_seed.png` / `_sprout.png` / `_bud.png` / `_ready.png` — red rose flower
- `crop_sunflower_seed.png` / `_sprout.png` / `_bud.png` / `_ready.png` — sunflower

### Animals (`animals/`)
- `animal_chicken.png` — a white cartoon chicken
- `animal_calf_calf.png` — a small brown calf
- `animal_calf_heifer.png` — a young cow
- `animal_calf_cow.png` — a fat happy cow
- `animal_dog.png` — a cute brown guard puppy
- `product_egg.png` — a single egg icon

### Buildings (`buildings/`)
- `building_house.png` — a cozy farmhouse with a red roof
- `building_barn.png` — a small red wooden barn
- `building_doghouse.png` — a wooden dog house

### Decorations (`decor/`)
- `decor_flower_pot.png` — a colorful flower pot
- `decor_wood_sign.png` — a wooden farm sign

### UI icons (`ui/`)
- `icon_coin.png` — a gold coin / coin stack
- `icon_water.png` — a watering can
- `icon_hoe.png` — a hoe tool
- `icon_seed.png` — a seed bag
- `icon_fertilizer.png` — a fertilizer bag
