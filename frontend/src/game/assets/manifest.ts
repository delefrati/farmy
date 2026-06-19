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
];

export const assetManifest: AssetEntry[] = [
  ...tileAssets,
  ...cropAssets,
  ...animalAssets,
  ...decorAssets,
  ...buildingAssets,
  ...uiAssets,
];
