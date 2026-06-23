import { crops } from '../data/crops';
import { animalDefinitions } from '../data/animals';
import { decorations } from '../data/decorations';

/**
 * Maps a Phaser texture key to the public asset URL it loads from.
 *
 * Keys are derived from the same data the gameplay uses, so adding a crop /
 * animal / decoration automatically adds its expected texture key here. Drop a
 * matching PNG into `frontend/public/assets/...` (see that folder's README for
 * the exact file names) and it will be picked up. Files that don't exist yet
 * are tolerated by the loader, which falls back to the old shape rendering.
 */
export interface AssetEntry {
  key: string;
  url: string;
}

const BASE = 'assets';

const tileAssets: AssetEntry[] = [
  { key: 'tile_soil', url: `${BASE}/tiles/tile_soil.png` },
  { key: 'tile_grass', url: `${BASE}/tiles/tile_grass.png` },
  { key: 'tile_locked', url: `${BASE}/tiles/tile_locked.png` },
];

const cropAssets: AssetEntry[] = crops.flatMap((crop) =>
  crop.stages.map((stage) => ({
    key: `crop_${crop.id}_${stage}`,
    url: `${BASE}/crops/crop_${crop.id}_${stage}.png`,
  })),
);

const animalAssets: AssetEntry[] = animalDefinitions.flatMap((def) => {
  if (def.kind === 'growing' && def.growStages) {
    return def.growStages.map((stage) => ({
      key: `animal_${def.id}_${stage.toLowerCase()}`,
      url: `${BASE}/animals/animal_${def.id}_${stage.toLowerCase()}.png`,
    }));
  }
  const entries: AssetEntry[] = [
    { key: `animal_${def.id}`, url: `${BASE}/animals/animal_${def.id}.png` },
  ];
  if (def.productId) {
    entries.push({
      key: `product_${def.productId}`,
      url: `${BASE}/animals/product_${def.productId}.png`,
    });
  }
  return entries;
});

// Single-frame "deceased" art for animals that can starve. Loaded as plain
// images (no animation). Growing animals share one carcass (`animal_calf_dead`)
// regardless of their growth stage. Missing files fall back to a tinted body.
const animalDeadAssets: AssetEntry[] = [
  { key: 'animal_chicken_dead', url: `${BASE}/animals/animal_chicken_dead_strip1.png` },
  { key: 'animal_calf_dead', url: `${BASE}/animals/animal_calf_dead_strip1.png` },
];

const decorAssets: AssetEntry[] = decorations.map((decor) => ({
  key: `decor_${decor.id}`,
  url: `${BASE}/decor/decor_${decor.id}.png`,
}));

const buildingAssets: AssetEntry[] = [
  { key: 'building_house', url: `${BASE}/buildings/building_house.png` },
  { key: 'building_barn', url: `${BASE}/buildings/building_barn.png` },
  { key: 'building_doghouse', url: `${BASE}/buildings/building_doghouse.png` },
  { key: 'animal_dog', url: `${BASE}/animals/animal_dog.png` },
];

const uiAssets: AssetEntry[] = [
  { key: 'icon_coin', url: `${BASE}/ui/icon_coin.png` },
  { key: 'icon_water', url: `${BASE}/ui/icon_water.png` },
  { key: 'icon_hoe', url: `${BASE}/ui/icon_hoe.png` },
  { key: 'icon_seed', url: `${BASE}/ui/icon_seed.png` },
  { key: 'icon_fertilizer', url: `${BASE}/ui/icon_fertilizer.png` },
  { key: 'button_green', url: `${BASE}/ui/button_green.png` },
  { key: 'button_blue', url: `${BASE}/ui/button_blue.png` },
  { key: 'button_red', url: `${BASE}/ui/button_red.png` },
  { key: 'button_purple', url: `${BASE}/ui/button_purple.png` },
  { key: 'panel_wood', url: `${BASE}/ui/panel_wood.png` },
  { key: 'panel_ribbon', url: `${BASE}/ui/panel_ribbon.png` },
  { key: 'icon_pesticide', url: `${BASE}/ui/icon_pesticide.png` },
  { key: 'icon_weed', url: `${BASE}/ui/icon_weed.png` },
  { key: 'icon_bug', url: `${BASE}/ui/icon_bug.png` },
  { key: 'icon_harvest', url: `${BASE}/ui/icon_harvest.png` },
  { key: 'icon_sell', url: `${BASE}/ui/icon_sell.png` },
  { key: 'icon_gift', url: `${BASE}/ui/icon_gift.png` },
  { key: 'icon_popularity', url: `${BASE}/ui/icon_popularity.png` },
  { key: 'icon_xp', url: `${BASE}/ui/icon_xp.png` },
  { key: 'icon_calendar', url: `${BASE}/ui/icon_calendar.png` },
  { key: 'icon_dog', url: `${BASE}/ui/icon_dog.png` },
  { key: 'icon_lock', url: `${BASE}/ui/icon_lock.png` },
  { key: 'icon_sync', url: `${BASE}/ui/icon_sync.png` },
  { key: 'icon_globe', url: `${BASE}/ui/icon_globe.png` },
  { key: 'logo_farmy', url: `${BASE}/ui/logo_farmy.png` },
  { key: 'neighbor_avatar_maria', url: `${BASE}/ui/neighbor_avatar_maria.png` },
  { key: 'neighbor_avatar_joao', url: `${BASE}/ui/neighbor_avatar_joao.png` },
  { key: 'neighbor_avatar_ana', url: `${BASE}/ui/neighbor_avatar_ana.png` },
  { key: 'avatar_placeholder', url: `${BASE}/ui/avatar_placeholder.png` },
];

const backgroundAssets: AssetEntry[] = [
  { key: 'bg_farm', url: `${BASE}/bg/bg_farm.png` },
  { key: 'bg_neighbor', url: `${BASE}/bg/bg_neighbor.png` },
];

export const assetManifest: AssetEntry[] = [
  ...backgroundAssets,
  ...tileAssets,
  ...cropAssets,
  ...animalAssets,
  ...animalDeadAssets,
  ...decorAssets,
  ...buildingAssets,
  ...uiAssets,
];

/**
 * Animated effect sprite-strips. Loaded as Phaser spritesheets (a single PNG
 * cut into equal frames left-to-right). The frame count is encoded in the file
 * name (`_stripN`). Missing files are tolerated like the rest, so an effect
 * simply doesn't play when its art isn't present.
 */
export interface SpriteSheetEntry {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  /**
   * Optional explicit playback order. When the source strip isn't a clean
   * frame-by-frame sequence (e.g. it mixes unrelated concept frames), list the
   * frame indices to play, in order. Defaults to 0..frameCount-1.
   */
  frameSequence?: number[];
}

export const spriteSheetManifest: SpriteSheetEntry[] = [
  {
    key: 'fx_water_splash',
    url: `${BASE}/fx/fx_water_splash_strip6.png`,
    frameWidth: 256,
    frameHeight: 336,
    frameCount: 6,
    // The strip mixes distinct concepts (drop-on-sprout, splashes, a withered
    // stick, a heart). Play only a coherent splash arc: drop -> big -> medium
    // -> small settle, skipping the dead-stick (3) and heart (5) frames.
    frameSequence: [0, 2, 1, 4],
  },
];

/**
 * Animated animal sprite-strips. Unlike {@link SpriteSheetEntry} these are
 * loaded as plain images and sliced into frames at runtime, so the frame size
 * doesn't need to be known up-front (the loader divides the strip width by
 * `frameCount`). This keeps the pipeline size-agnostic across the differently
 * sized strips ChatGPT produces. Each entry becomes a looping animation whose
 * key equals `key`. Missing files are tolerated — the farm falls back to the
 * existing static animal textures.
 */
export interface AnimalAnimEntry {
  key: string;
  url: string;
  /**
   * Optional explicit frame count. When omitted, {@link BootScene} derives it
   * from the strip's proportions (`round(width / height)`, frames are square),
   * so dropping in a 4-, 8- or 12-frame strip needs no manifest edit.
   */
  frameCount?: number;
  frameRate?: number;
}

export const animalAnimManifest: AnimalAnimEntry[] = [
  { key: 'animal_chicken_idle', url: `${BASE}/animals/animal_chicken_idle_strip8.png` },
  { key: 'animal_chicken_hungry', url: `${BASE}/animals/animal_chicken_hungry_strip8.png` },
  { key: 'animal_chicken_ready', url: `${BASE}/animals/animal_chicken_ready_strip8.png` },
  { key: 'animal_calf_calf_idle', url: `${BASE}/animals/animal_calf_calf_idle_strip8.png` },
  { key: 'animal_calf_calf_hungry', url: `${BASE}/animals/animal_calf_calf_hungry_strip8.png` },
  { key: 'animal_calf_heifer_idle', url: `${BASE}/animals/animal_calf_heifer_idle_strip8.png` },
  { key: 'animal_calf_heifer_hungry', url: `${BASE}/animals/animal_calf_heifer_hungry_strip8.png` },
  { key: 'animal_calf_cow_idle', url: `${BASE}/animals/animal_calf_cow_idle_strip8.png` },
  { key: 'animal_calf_cow_hungry', url: `${BASE}/animals/animal_calf_cow_hungry_strip8.png` },
  { key: 'animal_dog_idle', url: `${BASE}/animals/animal_dog_idle_strip8.png` },
  { key: 'animal_dog_alert', url: `${BASE}/animals/animal_dog_alert_strip8.png` },
];
