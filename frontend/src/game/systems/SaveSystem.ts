import { createDefaultFarmTiles, GRID_COLUMNS, GRID_ROWS, type FarmTile } from '../types/farm';
import { createDefaultEconomy, type PlayerEconomy } from '../types/economy';
import { createDefaultInventory, type PlayerInventory } from '../types/inventory';
import { createDefaultAnimals, type AnimalState, type PlayerAnimals } from '../types/animals';
import { defaultCropId } from '../data/crops';
import type { SaveGame } from '../types/save';

const SAVE_KEY = 'farmy.save.v1';
const SAVE_VERSION = 6;

// Animal state shape used before v6 (aggregate chicken coops + pooled eggs).
type LegacyAnimals = {
  chickenCoops: number;
  eggs: number;
  lastEggTickAt: number;
};

type LegacySaveGameV1 = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  selectedCropId: string;
  farmTiles: FarmTile[];
};

type LegacySaveGameV2 = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  selectedCropId: string;
  farmTiles: FarmTile[];
};

// v3 and v4 share the same structure (animals present, tiles carry optional
// care/season fields), differing only in version number and tile contents.
// They use the legacy aggregate animals shape.
type LegacySaveGameV3OrV4 = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  animals: LegacyAnimals;
  selectedCropId: string;
  farmTiles: FarmTile[];
};

// v5 added the fertilizers map but still used the legacy aggregate animals.
type LegacySaveGameV5 = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  fertilizers: PlayerInventory;
  animals: LegacyAnimals;
  selectedCropId: string;
  farmTiles: FarmTile[];
};

const isLegacyAnimals = (value: unknown): value is LegacyAnimals => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const animals = value as Partial<LegacyAnimals>;
  return (
    typeof animals.chickenCoops === 'number' &&
    typeof animals.eggs === 'number' &&
    typeof animals.lastEggTickAt === 'number'
  );
};

const isValidAnimalState = (value: unknown): value is AnimalState => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as Partial<AnimalState>;
  return (
    typeof state.id === 'string' &&
    typeof state.defId === 'string' &&
    typeof state.fedUntil === 'number' &&
    typeof state.lastTickAt === 'number' &&
    typeof state.storedProduct === 'number' &&
    typeof state.produceProgressMs === 'number' &&
    typeof state.growthMs === 'number' &&
    typeof state.matured === 'boolean'
  );
};

const isValidAnimals = (value: unknown): value is PlayerAnimals => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const animals = value as Partial<PlayerAnimals>;
  return Array.isArray(animals.animals) && animals.animals.every(isValidAnimalState);
};

// Convert the pre-v6 aggregate animals into the per-instance model. Each coop
// becomes a (hungry) chicken instance, and any pooled eggs are moved into the
// sellable inventory so progress is not lost.
const convertLegacyAnimals = (
  legacy: LegacyAnimals,
  now: number,
): { animals: PlayerAnimals; eggsToInventory: number } => {
  const animals: AnimalState[] = [];
  const coops = Math.max(0, Math.floor(legacy.chickenCoops));
  for (let index = 0; index < coops; index += 1) {
    animals.push({
      id: `animal_legacy_${now.toString(36)}_${index}`,
      defId: 'chicken',
      fedUntil: now,
      lastTickAt: now,
      storedProduct: 0,
      produceProgressMs: 0,
      growthMs: 0,
      matured: false,
    });
  }

  return {
    animals: { animals },
    eggsToInventory: Math.max(0, Math.floor(legacy.eggs)),
  };
};

const isValidInventory = (value: unknown): value is PlayerInventory => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === 'number');
};

const isValidEconomy = (value: unknown): value is PlayerEconomy => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const economy = value as Partial<PlayerEconomy>;
  return (
    typeof economy.coins === 'number' &&
    typeof economy.xp === 'number' &&
    typeof economy.level === 'number'
  );
};

const isValidFarmTile = (value: unknown): value is FarmTile => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tile = value as Partial<FarmTile>;
  return (
    typeof tile.id === 'string' &&
    typeof tile.x === 'number' &&
    typeof tile.y === 'number' &&
    (tile.state === 'empty' || tile.state === 'planted' || tile.state === 'dead') &&
    (tile.cropId === undefined || typeof tile.cropId === 'string') &&
    (tile.plantedAt === undefined || typeof tile.plantedAt === 'number') &&
    (tile.decorationId === undefined || typeof tile.decorationId === 'string') &&
    (tile.health === undefined || typeof tile.health === 'number') &&
    (tile.isDry === undefined || typeof tile.isDry === 'boolean') &&
    (tile.hasWeeds === undefined || typeof tile.hasWeeds === 'boolean') &&
    (tile.hasPests === undefined || typeof tile.hasPests === 'boolean') &&
    (tile.wateredAt === undefined || typeof tile.wateredAt === 'number') &&
    (tile.careUpdatedAt === undefined || typeof tile.careUpdatedAt === 'number') &&
    (tile.weedIntervalSeen === undefined || typeof tile.weedIntervalSeen === 'number') &&
    (tile.pestIntervalSeen === undefined || typeof tile.pestIntervalSeen === 'number') &&
    (tile.season === undefined || typeof tile.season === 'number') &&
    (tile.fertilizedStage === undefined || typeof tile.fertilizedStage === 'number')
  );
};

const isValidSaveGame = (value: unknown): value is SaveGame => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const save = value as Partial<SaveGame>;
  return (
    typeof save.version === 'number' &&
    typeof save.savedAt === 'string' &&
    isValidEconomy(save.economy) &&
    isValidInventory(save.inventory) &&
    isValidInventory(save.fertilizers) &&
    isValidAnimals(save.animals) &&
    typeof save.selectedCropId === 'string' &&
    Array.isArray(save.farmTiles) &&
    save.farmTiles.length === GRID_COLUMNS * GRID_ROWS &&
    save.farmTiles.every(isValidFarmTile)
  );
};

const isValidLegacySaveGameV2 = (value: unknown): value is LegacySaveGameV2 => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const save = value as Partial<LegacySaveGameV2>;
  return (
    typeof save.version === 'number' &&
    typeof save.savedAt === 'string' &&
    isValidEconomy(save.economy) &&
    isValidInventory(save.inventory) &&
    typeof save.selectedCropId === 'string' &&
    Array.isArray(save.farmTiles) &&
    save.farmTiles.length === GRID_COLUMNS * GRID_ROWS &&
    save.farmTiles.every(isValidFarmTile)
  );
};

const isValidLegacySaveGameV3OrV4 = (value: unknown): value is LegacySaveGameV3OrV4 => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const save = value as Partial<LegacySaveGameV3OrV4>;
  return (
    typeof save.version === 'number' &&
    typeof save.savedAt === 'string' &&
    isValidEconomy(save.economy) &&
    isValidInventory(save.inventory) &&
    isLegacyAnimals(save.animals) &&
    typeof save.selectedCropId === 'string' &&
    Array.isArray(save.farmTiles) &&
    save.farmTiles.length === GRID_COLUMNS * GRID_ROWS &&
    save.farmTiles.every(isValidFarmTile)
  );
};

const isValidLegacySaveGameV5 = (value: unknown): value is LegacySaveGameV5 => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const save = value as Partial<LegacySaveGameV5>;
  return (
    typeof save.version === 'number' &&
    typeof save.savedAt === 'string' &&
    isValidEconomy(save.economy) &&
    isValidInventory(save.inventory) &&
    isValidInventory(save.fertilizers) &&
    isLegacyAnimals(save.animals) &&
    typeof save.selectedCropId === 'string' &&
    Array.isArray(save.farmTiles) &&
    save.farmTiles.length === GRID_COLUMNS * GRID_ROWS &&
    save.farmTiles.every(isValidFarmTile)
  );
};

const isValidLegacySaveGameV1 = (value: unknown): value is LegacySaveGameV1 => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const save = value as Partial<LegacySaveGameV1>;
  return (
    typeof save.version === 'number' &&
    typeof save.savedAt === 'string' &&
    isValidEconomy(save.economy) &&
    typeof save.selectedCropId === 'string' &&
    Array.isArray(save.farmTiles) &&
    save.farmTiles.length === GRID_COLUMNS * GRID_ROWS &&
    save.farmTiles.every(isValidFarmTile)
  );
};

export class SaveSystem {
  createDefaultSave(): SaveGame {
    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      economy: createDefaultEconomy(),
      inventory: createDefaultInventory(),
      fertilizers: createDefaultInventory(),
      animals: createDefaultAnimals(),
      selectedCropId: defaultCropId,
      farmTiles: createDefaultFarmTiles(),
    };
  }

  saveGame(saveInput: {
    economy: PlayerEconomy;
    inventory: PlayerInventory;
    fertilizers: PlayerInventory;
    animals: PlayerAnimals;
    selectedCropId: string;
    farmTiles: FarmTile[];
  }): SaveGame {
    const save: SaveGame = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      economy: saveInput.economy,
      inventory: saveInput.inventory,
      fertilizers: saveInput.fertilizers,
      animals: saveInput.animals,
      selectedCropId: saveInput.selectedCropId,
      farmTiles: saveInput.farmTiles,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return save;
  }

  replaceLocalSave(save: SaveGame): SaveGame {
    if (!isValidSaveGame(save) || save.version !== SAVE_VERSION) {
      throw new Error('invalid_save_payload');
    }

    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return save;
  }

  loadGame(): SaveGame {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const initial = this.createDefaultSave();
      this.saveGame(initial);
      return initial;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isValidSaveGame(parsed) && parsed.version === SAVE_VERSION) {
        return parsed;
      }

      const now = Date.now();

      // v5 had the fertilizers map but used the legacy aggregate animals shape.
      if (isValidLegacySaveGameV5(parsed) && parsed.version === 5) {
        const converted = convertLegacyAnimals(parsed.animals, now);
        const migrated: SaveGame = {
          ...parsed,
          version: SAVE_VERSION,
          animals: converted.animals,
          inventory: {
            ...parsed.inventory,
            egg: (parsed.inventory.egg ?? 0) + converted.eggsToInventory,
          },
        };
        this.saveGame(migrated);
        return migrated;
      }

      // v3 and v4 lack the fertilizers map and use the legacy animals shape.
      if (isValidLegacySaveGameV3OrV4(parsed) && (parsed.version === 3 || parsed.version === 4)) {
        const converted = convertLegacyAnimals(parsed.animals, now);
        const migrated: SaveGame = {
          ...parsed,
          version: SAVE_VERSION,
          fertilizers: createDefaultInventory(),
          animals: converted.animals,
          inventory: {
            ...parsed.inventory,
            egg: (parsed.inventory.egg ?? 0) + converted.eggsToInventory,
          },
        };
        this.saveGame(migrated);
        return migrated;
      }

      if (isValidLegacySaveGameV1(parsed) && parsed.version === 1) {
        const migrated: SaveGame = {
          ...parsed,
          version: SAVE_VERSION,
          inventory: createDefaultInventory(),
          fertilizers: createDefaultInventory(),
          animals: createDefaultAnimals(),
        };
        this.saveGame(migrated);
        return migrated;
      }

      if (isValidLegacySaveGameV2(parsed) && parsed.version === 2) {
        const migrated: SaveGame = {
          ...parsed,
          version: SAVE_VERSION,
          fertilizers: createDefaultInventory(),
          animals: createDefaultAnimals(),
        };
        this.saveGame(migrated);
        return migrated;
      }
    } catch {
      // If parsing fails, fall through to recreate a safe default save.
    }

    const fallback = this.createDefaultSave();
    this.saveGame(fallback);
    return fallback;
  }

  clearSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
