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

---

# Phase 2 assets — backgrounds, menu, decorations, effects

Everything above skins the farm grid. The assets below skin the rest of the
screen: the world background, the HUD/menu chrome, more decorations, and small
juice (effects, status badges). All optional and gated behind
`this.textures.exists(key)` like the rest, so they can be added incrementally.

Keep the SAME style suffix as above so the whole game looks unified.

## Backgrounds (`bg/`)
Used as a full-scene image behind the grid (replaces the flat `#9fdd7a` /
`#cfe8b0` fill on FarmScene / NeighborScene). Make them 1280x860 to match the
canvas, with the action area kept calm/low-contrast so sprites read on top.

- `bg_farm.png` — the player's farm: rolling green field, soft sky, distant
  trees/hills, gentle path. Main scene backdrop.
- `bg_neighbor.png` — a neighbor's farm: same world, slightly different palette
  (cooler/greener) so visiting feels like a different place.
- `bg_sky_strip.png` — optional tall sky/cloud strip for the top of the scene
  (parallax-friendly, tileable horizontally).
- `bg_fence_row.png` — a horizontal wooden fence strip to frame the field edge
  (tileable horizontally).

## Menu / HUD chrome (`ui/`)
The HUD is currently colored text on flat rectangles. These give it a polished
"game panel" frame. Use 9-slice friendly art (flat-color center, decorative
corners) so it can stretch without distortion.

- `panel_wood.png` — rounded wooden/parchment panel for HUD and modals (9-slice).
- `panel_ribbon.png` — a small banner/ribbon header for panel titles.
- `button_green.png` — primary action button (sell, plant, claim) — 9-slice.
- `button_blue.png` — neutral/secondary button (sync, visit) — 9-slice.
- `button_red.png` — destructive/warning button (reset, logout) — 9-slice.
- `button_purple.png` — toggle button (pacing, language, decoration mode).
- `badge_level.png` — small round badge for the level number.
- `bar_frame.png` + `bar_fill.png` — XP / health bar frame and fill.
- `coin_pill.png` — rounded plaque the coin count sits inside (top-left HUD).

## Tool / action icons (`ui/`)
Small icons to put ON the buttons and the per-tile action hints (currently
text only). Square, ~128px, centered.

- `icon_pesticide.png` — a bug-spray / pesticide bottle (remove pests).
- `icon_weed.png` — a weed/grass tuft (remove weeds).
- `icon_bug.png` — a cartoon bug/beetle (pest indicator + sabotage).
- `icon_harvest.png` — a basket of produce (harvest action).
- `icon_sell.png` — a price tag / coins-out (sell action).
- `icon_gift.png` — a wrapped gift / bouquet (gifts inbox + send flower).
- `icon_popularity.png` — a heart or star (popularity stat).
- `icon_xp.png` — a star/spark (XP stat).
- `icon_calendar.png` — a daily-reward calendar/checkmark.
- `icon_dog.png` — a small guard-dog head (dog protection indicator).
- `icon_lock.png` — a padlock (locked plot price tag; complements `tile_locked`).
- `icon_sync.png` — a cloud / refresh arrows (save sync button).
- `icon_globe.png` — a globe (language switcher).

## Tile status overlays (`fx/`)
Small badges drawn on a tile to show care state (currently text like
"dry,weeds"). Transparent, ~96px, designed to sit in a tile corner.

- `fx_dry.png` — a wilting / water-drop-with-cross "needs water" badge.
- `fx_weeds.png` — weeds overlay sprite.
- `fx_pests.png` — bugs overlay sprite.
- `fx_dead.png` — withered/brown crop overlay (for the `dead` tile state).
- `fx_ready.png` — a "ready!" sparkle/glow ring for harvestable crops.
- `fx_lowhealth.png` — a red warning heart for low-health crops.

## Effects / juice (`fx/`)
Optional feedback animations. Provide as either a single PNG or a horizontal
sprite-strip (note frame count in the file name, e.g. `_strip6`).

- `fx_water_splash_strip6.png` — watering splash.
- `fx_sparkle_strip5.png` — harvest / level-up sparkle.
- `fx_coin_pop_strip4.png` — coins flying up when selling.
- `fx_heart_strip4.png` — popularity / gift received.
- `fx_dust_strip5.png` — hoe / clearing a dead crop.

## More decorations (`decor/`)
Beyond the two existing decorations. Same tile footprint as crops so they sit on
the grid. Add matching entries to `data/decorations.ts` when introduced.

- `decor_tree.png` — a round leafy shade tree.
- `decor_pond.png` — a small pond.
- `decor_well.png` — a stone water well.
- `decor_scarecrow.png` — a friendly scarecrow.
- `decor_flower_bed.png` — a bed of mixed flowers.
- `decor_haystack.png` — a hay bale stack.
- `decor_lamp.png` — a little garden lamp post.
- `decor_path_tile.png` — a stone/dirt path tile.
- `decor_fence_post.png` — a single fence post / corner.

## Title / meta screens (`ui/`)
For a polished entry point (not built yet, but worth generating once).

- `logo_farmy.png` — the game logo/wordmark.
- `bg_title.png` — title-screen background (1280x860).
- `avatar_placeholder.png` — round player avatar frame for the HUD.
- `neighbor_avatar_maria.png` / `_joao.png` / `_ana.png` — the three NPC
  neighbor portraits (used on visit buttons + the visit header).

---

## Notes for whoever generates these
- Match canvas size 1280x860 for full backgrounds.
- Panels/buttons: keep a flat-color center and detail only the border so they
  9-slice cleanly. Aim for ~32px corner insets.
- Status overlays and effects: transparent background, strong silhouette so
  they read at small (~48-96px) sizes on a busy tile.
- Sprite strips: lay frames left-to-right, equal width, and include the frame
  count in the file name (`_strip6`).
- Drop files into the matching subfolder; the loader tolerates anything still
  missing, so partial batches are fine.

---

# Ready-to-paste generation prompts (Phase 2)

Generate each sheet SEPARATELY (one image per block below). Do NOT combine them
into one contact sheet — that produces thumbnails too small to use. Each block
already includes the shared style so it stays consistent with the first batch.

After generating, hand the files to the dev; the existing
`doc/assets/slice_assets.py` script slices grid sheets the same way it did for
the crops.

**Shared rules baked into every prompt below:**
- glossy cartoon mobile farm game art, soft cel shading, thick clean outlines,
  warm saturated colors, Hay Day / Happy Farm style.
- NO text, NO labels, NO numbers anywhere in the image.
- Items evenly spaced on a FULLY TRANSPARENT background (alpha), generous gaps.

## 1. Background — player farm (generate alone, 1536x1024)
```
A glossy cartoon farm game background, top-down 3/4 view of a sunny green farm
field: rolling grass, soft blue sky with a few fluffy clouds at the top, distant
trees and gentle hills on the horizon, a dirt path, wooden fences at the edges.
Calm, low-contrast center so game pieces placed on top stand out. Hay Day /
Happy Farm style, warm saturated colors, no characters, no text, no UI.
Full-bleed illustration, 1536x1024.
```
Export as `bg_farm.png` (dev will fit it to 1280x860).

## 2. Background — neighbor farm (generate alone, 1536x1024)
```
Same as the farm background above, but a neighbor's farm: a slightly cooler,
greener palette and a different layout of trees and path, so it feels like a
different place. Glossy cartoon Hay Day / Happy Farm style, no characters, no
text, no UI. Full-bleed illustration, 1536x1024.
```
Export as `bg_neighbor.png`.

## 3. Buttons + panels (1024x1024, 2x3 grid, transparent)
```
A 2 by 3 grid of glossy cartoon game UI elements on a fully transparent
background, evenly spaced, no text: top-left a green rounded wooden button,
top-middle a blue rounded wooden button, top-right a red rounded wooden button,
bottom-left a purple rounded wooden button, bottom-middle a large blank rounded
wooden/parchment panel, bottom-right a small decorative banner ribbon. Thick
clean outlines, soft shading, Hay Day / Happy Farm style. Each element blank
(no icons, no text).
```
Slices to `button_green`, `button_blue`, `button_red`, `button_purple`,
`panel_wood`, `panel_ribbon`.

## 4. Tool / action icons (1024x1024, 4x4 grid, transparent)
```
A 4 by 4 grid of glossy cartoon farm game icons on a fully transparent
background, evenly spaced, each icon centered in its cell, no text:
1 bug-spray pesticide bottle, 2 a green weed tuft, 3 a cartoon beetle bug,
4 a basket of harvested produce, 5 a price tag, 6 a wrapped gift box,
7 a red heart, 8 a yellow star, 9 a daily calendar with a checkmark,
10 a friendly dog head, 11 a gold padlock, 12 cloud-with-refresh-arrows,
13 a globe, 14 a watering can, 15 a hoe tool, 16 a seed bag.
Thick clean outlines, soft shading, bright colors, Hay Day / Happy Farm style.
```
Slices to `icon_pesticide`, `icon_weed`, `icon_bug`, `icon_harvest`,
`icon_sell`, `icon_gift`, `icon_popularity`, `icon_xp`, `icon_calendar`,
`icon_dog`, `icon_lock`, `icon_sync`, `icon_globe` (re-uses water/hoe/seed too).

## 5. Tile status badges (1024x1024, 2x3 grid, transparent)
```
A 2 by 3 grid of glossy cartoon status badges for a farm game, on a fully
transparent background, evenly spaced, no text: 1 a blue water drop with a small
"needs water" wilting leaf, 2 a clump of green weeds, 3 a cluster of little bugs,
4 a withered brown dead plant, 5 a golden sparkle/glow ring meaning "ready",
6 a red warning heart meaning low health. Bold simple silhouettes that read at
small sizes, thick outlines, Hay Day / Happy Farm style.
```
Slices to `fx_dry`, `fx_weeds`, `fx_pests`, `fx_dead`, `fx_ready`,
`fx_lowhealth`.

## 6. Effect strips (generate each alone, 1024x256, transparent)
One image per effect; frames laid left-to-right, equal width.
```
A horizontal sprite-sheet strip of a glossy cartoon WATER SPLASH animation,
6 equal frames left to right showing the splash appearing and fading, on a fully
transparent background, no text. Bright cartoon style, thick outlines. 1024x256.
```
Repeat, swapping the subject, for:
- sparkle burst, 5 frames -> `fx_sparkle_strip5.png`
- gold coins popping upward, 4 frames -> `fx_coin_pop_strip4.png`
- floating hearts, 4 frames -> `fx_heart_strip4.png`
- brown dust puff, 5 frames -> `fx_dust_strip5.png`
Water splash above -> `fx_water_splash_strip6.png`.

## 7. Extra decorations (1254x1254, 3x3 grid, transparent)
```
A 3 by 3 grid of glossy cartoon farm decorations in top-down 3/4 view, on a
fully transparent background, evenly spaced, each object centered, no text:
1 a round leafy shade tree, 2 a small pond, 3 a stone water well,
4 a friendly scarecrow, 5 a bed of mixed flowers, 6 a stack of hay bales,
7 a little garden lamp post, 8 a stone path tile, 9 a single wooden fence post.
Thick clean outlines, soft shading, Hay Day / Happy Farm style.
```
Slices to `decor_tree`, `decor_pond`, `decor_well`, `decor_scarecrow`,
`decor_flower_bed`, `decor_haystack`, `decor_lamp`, `decor_path_tile`,
`decor_fence_post`.

## 8. Logo (generate alone, 1024x512, transparent)
```
A glossy cartoon game logo wordmark reading "Farmy" in chunky rounded
hand-drawn letters, warm green and yellow with a thick cream outline and a small
strawberry or leaf accent, on a fully transparent background. Playful, juicy,
Hay Day / Happy Farm style. No background scene.
```
Export as `logo_farmy.png`.

## 9. Neighbor avatars (1024x1024, 2x2 grid, transparent)
```
A 2 by 2 grid of glossy cartoon round character portrait icons of friendly farm
neighbors, on a fully transparent background, each in a simple round frame, no
text: top-left a cheerful woman with brown hair (Maria), top-right a smiling man
with a straw hat (Joao), bottom-left a young woman with blonde braids (Ana),
bottom-right a generic smiling farmer (placeholder). Thick outlines, warm colors,
Hay Day / Happy Farm style.
```
Slices to `neighbor_avatar_maria`, `neighbor_avatar_joao`,
`neighbor_avatar_ana`, `avatar_placeholder`.

---

# Phase 3 — animated animals + status states

Goal: show the animals as living sprites on the farm (not just a text list) with
frame-by-frame motion AND distinct visual states (fed/idle, hungry, ready,
deceased). These load through the SAME sprite-strip pipeline already used by
`fx_water_splash` — a single PNG cut into equal frames, listed in
`spriteSheetManifest` in `src/game/assets/manifest.ts` and built into a Phaser
animation in `BootScene`.

> IMPORTANT — do NOT make GIFs. Phaser's Canvas renderer cannot play animated
> GIF/WebP. Deliver each animation as a **horizontal sprite-strip PNG**: the
> same character drawn N times left-to-right, equal-width frames, transparent
> background. The frame count goes in the file name (`_strip4`, `_strip6`).

## Transparency — avoid the fake checkerboard (read this first)

ChatGPT / DALL·E almost always *fake* transparency: they paint a light-gray
**checkerboard pattern** (or a flat color) directly INTO the pixels instead of
using a real alpha channel. If you drop that straight into the game, the
animal will animate inside a gray checker box. Two ways to get genuinely
transparent PNGs:

1. **Ask, then clean (most reliable).** Generate the strip, then run it through
   the strip-safe cleaner which removes a baked-in checkerboard or flat color
   while keeping the full strip dimensions (so the equal frames survive):

   ```bash
   python3 doc/assets/clean_strip_bg.py path/to/animal_chicken_idle_strip4.png \
       frontend/public/assets/animals/animal_chicken_idle_strip4.png
   ```

   It auto-detects checkerboard vs flat backgrounds; force one with
   `--mode checker` or `--mode solid`. Already-transparent PNGs pass through
   untouched. (The grid `slice_assets.py` does the same for contact sheets, but
   it trims to content and would destroy a strip's frame layout — use
   `clean_strip_bg.py` for strips.)

2. **Generate on a flat key color.** If a model keeps drawing the checker even
   when asked for transparency, instead ask for a **solid flat magenta
   (#FF00FF) background** behind the frames (a color that never appears on the
   animal), then run `clean_strip_bg.py --mode solid`. A single flat color keys
   out far more cleanly than a checker.

Whichever you pick, ALWAYS verify the final PNG actually has alpha (open it over
a colored background, or check that it shows transparency in an image viewer)
before wiring it in — a checker that slips through will be very visible in-game.


## How the frames must be laid out (read before generating)

These rules make the strip slice and animate cleanly. Bake them into every
prompt (they're repeated in the shared block below):

- **One animation per image.** A single horizontal row of frames, left to right.
- **Equal-width frames, no gaps, no dividers, no frame borders/numbers.** The
  loader cuts the strip into `frameCount` equal slices, so any uneven spacing or
  visible grid lines will misalign the animation.
- **Identical character in every frame** — same colors, same outline, same size.
  Only the moving part (legs, wings, head, tail) changes between frames.
- **Locked position + baseline.** The animal's feet sit on the SAME invisible
  ground line and the body stays centered in each frame (no drifting across the
  strip), so it doesn't jitter when played.
- **Soft top-down 3/4 view** to match the existing static animal art.
- **Fully transparent background, no ground shadow, no text.**
- Target each frame roughly **square (256x256)**, so an **8-frame strip = 2048x256**
  (a 4-frame strip = 1024x256). More frames = smoother motion; the loader slices
  whatever it's given, so the count is flexible.

> **Frame count is auto-detected.** `BootScene` derives the number of frames from
> the strip's proportions (`round(width / height)`, frames are square), so you
> do NOT need to touch the manifest when you change the count — just keep the
> frames square and laid out in one even row. The `_stripN` in the file name is
> only documentation. Prefer **8 frames** for the smooth look; 4 still works.

**Shared style + frame block — paste at the END of every prompt below:**

```
Style: glossy cartoon mobile farm game art, soft cel shading, thick clean
outlines, warm saturated colors, soft top-down 3/4 view, Hay Day / Happy Farm
style. Horizontal sprite-sheet strip, frames laid left to right, EQUAL WIDTH,
evenly spaced with NO gaps, NO dividing lines, NO frame borders, NO numbers, NO
text. The SAME character in every frame — identical size, colors and outline;
only the described motion changes. Feet aligned on the same baseline, body
centered, no drifting. The background MUST be 100% empty: a real transparent
alpha background, completely uniform, with absolutely NO checkerboard pattern,
NO gray-and-white squares, NO grid, NO drop shadow, NO ground — nothing behind
the character but pure transparency.
```

> If the model still bakes in a gray checkerboard, regenerate asking for a
> "solid flat magenta (#FF00FF) background" instead, then key it out with
> `python3 doc/assets/clean_strip_bg.py <file> --mode solid` (see the
> Transparency section above).


## Required strips (file name -> frames -> what to draw)

Drop the PNGs in `frontend/public/assets/animals/`. Frame counts can be reduced
if the generator struggles with consistency — fewer frames animate more
reliably.

### Chicken (productive)
- `animal_chicken_idle_strip8.png` — 8 frames, calm chicken pecking the ground
  (head dips down and back up), occasional blink.
- `animal_chicken_hungry_strip8.png` — 8 frames, thin sad chicken, head drooping,
  wings sagging, looking around weakly.
- `animal_chicken_ready_strip8.png` — 8 frames, happy chicken clucking proudly
  with a fresh egg beside it (the "product ready to collect" state).
- `animal_chicken_dead_strip1.png` — 1 frame, gentle cartoon "fainted" chicken
  lying on its back, legs up, simple X eyes (not gory).

### Cow line (growing — three body stages)
- `animal_calf_calf_idle_strip8.png` — 8 frames, small brown calf chewing /
  swishing tail, ears flick.
- `animal_calf_calf_hungry_strip8.png` — 8 frames, the small calf looking thin
  and droopy, head low.
- `animal_calf_heifer_idle_strip8.png` — 8 frames, young cow chewing, tail swish.
- `animal_calf_heifer_hungry_strip8.png` — 8 frames, the young cow droopy/sad.
- `animal_calf_cow_idle_strip8.png` — 8 frames, fat happy cow chewing, tail swish,
  blink.
- `animal_calf_cow_hungry_strip8.png` — 8 frames, the fat cow looking thin and
  unhappy, head low.
- `animal_calf_dead_strip1.png` — 1 frame, gentle cartoon cow lying down on its
  side, simple X eyes (not gory). Shared across the cow stages.

### Dog (guard — not fed in the current model)
- `animal_dog_idle_strip8.png` — 8 frames, cute brown puppy sitting, tail wagging,
  blinking, ears twitch.
- `animal_dog_alert_strip8.png` — 8 frames, the same puppy standing and barking
  (mouth opens/closes, front paw lifts) — for the guard "caught a thief" moment.

## Ready-to-paste prompts

Generate each block as its OWN image. Append the shared style + frame block
(above) to every one.

> **How the `_idle` strip is played (important for the art).** The idle strip is
> NOT looped continuously — that makes a yard of animals move in robotic unison.
> Instead the game holds the animal on **frame 1 (a calm resting pose)** and adds
> subtle, *desynchronized* life procedurally (a gentle breathing bob + the
> occasional small head/kick wobble). Every few seconds, at random, it plays the
> whole idle strip **once** as a "peck" accent, then settles back on frame 1. So:
> make **frame 1 a clean neutral standing pose** (this is what's shown most of
> the time), put the actual action (the peck/chew) in the middle frames, and end
> on a pose close to frame 1 so it settles cleanly. The `_hungry` / `_ready`
> strips still loop normally.

### Chicken — idle (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of a plump white cartoon
chicken with a red comb and orange beak. Frame 1 is a calm neutral standing
pose (this is the resting pose). The strip then plays ONE pecking action and
returns to rest: frames 2-3 head tilting and lowering, frame 4 beak almost
touching the ground, frame 5 beak pecking the ground (one eye blinks), frames
6-7 head rising back up, frame 8 back to the same calm standing pose as frame 1.
Same chicken, same spot, in every frame.
```

### Chicken — hungry (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of the SAME white cartoon
chicken but hungry and weak: thinner body, droopy head and sagging wings, sad
half-closed eyes. ONE slow, tired looping sway: frames 1-2 head hanging low and
centered, frames 3-4 weakly turning to look left, frame 5 back to center, frames
6-7 weakly turning to look right, frame 8 returning toward center (loops into
frame 1). Movement is small and sluggish. Same chicken, same spot.
```

### Chicken — ready / egg laid (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of the SAME white cartoon
chicken looking happy and proud next to a single fresh white egg resting on the
ground: ONE looping proud-cluck cycle: frame 1 upright, frame 2 chest puffing up
with a little bob, frames 3-4 one wing lifting outward in a flap, frames 5-6 the
wing lowering back, frame 7 a small happy head cluck, frame 8 settling back to
frame 1. The egg stays in exactly the same place and size in every frame. Same
chicken, same spot.
```

### Chicken — deceased (256x256, single frame)
```
A single gentle cartoon frame of the SAME white chicken having fainted, lying on
its back with both legs sticking up and simple X-shaped closed eyes, a tiny
swirl above its head. Cute and harmless, NOT gory or bloody.
```

### Calf — idle (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of a small brown cartoon calf
with white patches. Frame 1 is a calm neutral standing pose (the resting pose).
The strip then plays ONE gentle idle action and returns to rest: frames 2-3 slow
chewing (jaw down and up), frames 4-6 the tail swishing across, frames 7-8 ears
flicking and a blink, ending on the same calm pose as frame 1. Same calf, same
spot, in every frame.
```

### Calf — hungry (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of the SAME small brown calf
looking hungry: thinner, head hanging low, sad droopy eyes. ONE slow tired
looping motion: frames 1-2 head low and still, frames 3-4 a weak slow sway to
one side, frame 5 center, frames 6-7 a weak sway to the other side, frame 8
returning toward center to loop. Small, sluggish movement. Same calf, same spot.
```

### Heifer — idle (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of a young cartoon cow (heifer,
medium size, brown and white). Frame 1 is a calm neutral standing pose (the
resting pose). The strip then plays ONE gentle idle action and returns to rest:
frames 2-3 slow chewing, frames 4-6 tail swishing across, frames 7-8 ears
flicking and a blink, ending on the same calm pose as frame 1. Same cow, same
spot.
```

### Heifer — hungry (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of the SAME young cow looking
hungry and droopy: thinner, head low, sad eyes. ONE slow looping tired sway:
frames 1-2 head low, frames 3-4 weak lean one way, frame 5 center, frames 6-7
weak lean the other way, frame 8 back toward center to loop. Same cow, same spot.
```

### Cow — idle (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of a big fat happy cartoon cow
(brown and white, pink udder). Frame 1 is a calm neutral standing pose (the
resting pose). The strip then plays ONE gentle idle action and returns to rest:
frames 2-3 slow chewing, frames 4-6 tail swishing across, frames 7-8 a blink and
ear flick, ending on the same calm pose as frame 1. Same cow, same spot.
```

### Cow — hungry (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of the SAME big cow looking
hungry and unhappy: thinner, head hanging low, sad droopy eyes. ONE slow looping
tired sway: frames 1-2 head low and still, frames 3-4 weak lean one way, frame 5
center, frames 6-7 weak lean the other way, frame 8 back toward center to loop.
Same cow, same spot.
```

### Cow line — deceased (256x256, single frame)
```
A single gentle cartoon frame of a brown-and-white cow lying down on its side
asleep/fainted, with simple X-shaped closed eyes and a tiny swirl above its head.
Cute and harmless, NOT gory or bloody. Used for any cow growth stage.
```

### Dog — idle (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of a cute brown cartoon guard
puppy sitting. Frame 1 is a calm seated resting pose. The strip then plays ONE
gentle idle action and returns to rest: frames 2-4 the tail wagging from side to
side, frame 5 a blink, frames 6-7 ears twitching, frame 8 back to the same calm
seated pose as frame 1. The body stays seated and centered. Same puppy, same
spot.
```

### Dog — alert / bark (2048x256, 8 frames)
```
A horizontal sprite-sheet strip of 8 equal frames of the SAME brown puppy
standing and barking in ONE looping cycle: frame 1 standing alert, frame 2 mouth
beginning to open, frame 3 mouth wide barking with one front paw lifting, frame
4 full bark, frames 5-6 mouth closing and paw lowering, frames 7-8 settling back
to the alert stance (loops into frame 1). Same puppy, same spot.
```

## After the art is generated (wiring notes for the dev)

1. Drop the PNGs in `frontend/public/assets/animals/`.
2. The animated strips are already wired: each one has an entry in
   `animalAnimManifest` in `manifest.ts` (keyed `animal_chicken_idle`,
   `animal_chicken_hungry`, `animal_chicken_ready`, the calf/heifer/cow stages
   and the dog). `BootScene` loads each strip, **auto-detects the frame count**
   from the image proportions, slices it, and builds a looping anim keyed by
   `key`. No manifest edit is needed when the frame count changes — just match
   the file name in the manifest URL (currently `_strip8`).
3. Single-frame `_strip1` "dead" sprites stay as plain `AssetEntry` images
   (`animal_chicken_dead`, `animal_calf_dead`) — no animation.
4. Owned animals already render as sprites and pick the anim by state in
   `FarmScene` (`resolveAnimalVisual`): fed -> `_idle`, `storedProduct>0` ->
   `_ready`, not fed -> `_hungry`, dead -> `_dead`. Missing strips fall back to
   the static animal texture, so a not-yet-delivered strip just shows the old
   static art.

> DONE — "deceased" is implemented: `AnimalState` has `starveMs` + `dead`
> flags, an animal left hungry past `ANIMAL.STARVE_SECONDS` dies, and the dead
> sprite (or a greyed/toppled fallback) renders for it. The optional `starveMs`
> / `dead` fields kept old saves valid, so no `SAVE_VERSION` bump was needed.