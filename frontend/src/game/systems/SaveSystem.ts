import { createDefaultFarmTiles, GRID_COLUMNS, GRID_ROWS, type FarmTile } from '../types/farm';
import { createDefaultEconomy, type PlayerEconomy } from '../types/economy';
import { createDefaultInventory, type PlayerInventory } from '../types/inventory';
import { createDefaultAnimals, type AnimalState, type PlayerAnimals } from '../types/animals';
import { defaultCropId } from '../data/crops';
import { createNeighborFarms, createStarterGifts } from './SocialSystem';
import type { FarmEvent, Gift, NeighborFarm } from '../types/social';
import type { SaveGame } from '../types/save';

const SAVE_KEY = 'farmy.save.v1';
const SAVE_VERSION = 9;

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

// v6 used the per-instance animals model but had no social state (neighbors /
// event log were added in v7).
type LegacySaveGameV6 = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  fertilizers: PlayerInventory;
  animals: PlayerAnimals;
  selectedCropId: string;
  farmTiles: FarmTile[];
};

// v7 added neighbors + event log but had no prestige track (popularity / gift
// inbox were added in v8).
type LegacySaveGameV7 = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  fertilizers: PlayerInventory;
  animals: PlayerAnimals;
  selectedCropId: string;
  farmTiles: FarmTile[];
  neighbors: NeighborFarm[];
  events: FarmEvent[];
};

// v8 added the prestige track but had no guard dogs (player.hasDog and
// neighbor.hasDog were added in v9).
type LegacySaveGameV8 = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  fertilizers: PlayerInventory;
  animals: PlayerAnimals;
  selectedCropId: string;
  farmTiles: FarmTile[];
  neighbors: NeighborFarm[];
  events: FarmEvent[];
  popularity: number;
  giftInbox: Gift[];
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
    (tile.fertilizedStage === undefined || typeof tile.fertilizedStage === 'number') &&
    (tile.stealRemaining === undefined || typeof tile.stealRemaining === 'number')
  );
};

const isValidNeighbor = (value: unknown): value is NeighborFarm => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const neighbor = value as Partial<NeighborFarm>;
  return (
    typeof neighbor.id === 'string' &&
    typeof neighbor.name === 'string' &&
    typeof neighbor.hasDog === 'boolean' &&
    Array.isArray(neighbor.tiles) &&
    neighbor.tiles.every(isValidFarmTile)
  );
};

const isValidNeighbors = (value: unknown): value is NeighborFarm[] =>
  Array.isArray(value) && value.every(isValidNeighbor);

// Pre-v9 neighbors had no `hasDog`. Used only by the v7/v8 legacy validators so
// those saves still parse before the v9 migration adds the dog flag.
const isLegacyNeighborNoDog = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const neighbor = value as Partial<NeighborFarm>;
  return (
    typeof neighbor.id === 'string' &&
    typeof neighbor.name === 'string' &&
    Array.isArray(neighbor.tiles) &&
    neighbor.tiles.every(isValidFarmTile)
  );
};

const isLegacyNeighborsNoDog = (value: unknown): boolean =>
  Array.isArray(value) && value.every(isLegacyNeighborNoDog);

const isValidEvent = (value: unknown): value is FarmEvent => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<FarmEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.at === 'number' &&
    (event.kind === 'help' ||
      event.kind === 'steal' ||
      event.kind === 'system' ||
      event.kind === 'sabotage' ||
      event.kind === 'caught') &&
    typeof event.message === 'string'
  );
};

const isValidEvents = (value: unknown): value is FarmEvent[] =>
  Array.isArray(value) && value.every(isValidEvent);

const isValidGift = (value: unknown): value is Gift => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const gift = value as Partial<Gift>;
  return (
    typeof gift.id === 'string' &&
    typeof gift.fromName === 'string' &&
    typeof gift.flowerId === 'string' &&
    typeof gift.at === 'number'
  );
};

const isValidGiftInbox = (value: unknown): value is Gift[] =>
  Array.isArray(value) && value.every(isValidGift);

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
    save.farmTiles.every(isValidFarmTile) &&
    isValidNeighbors(save.neighbors) &&
    isValidEvents(save.events) &&
    typeof save.popularity === 'number' &&
    isValidGiftInbox(save.giftInbox) &&
    typeof save.hasDog === 'boolean'
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

const isValidLegacySaveGameV6 = (value: unknown): value is LegacySaveGameV6 => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const save = value as Partial<LegacySaveGameV6>;
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

const isValidLegacySaveGameV7 = (value: unknown): value is LegacySaveGameV7 => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const save = value as Partial<LegacySaveGameV7>;
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
    save.farmTiles.every(isValidFarmTile) &&
    isLegacyNeighborsNoDog(save.neighbors) &&
    isValidEvents(save.events)
  );
};

const isValidLegacySaveGameV8 = (value: unknown): value is LegacySaveGameV8 => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const save = value as Partial<LegacySaveGameV8>;
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
    save.farmTiles.every(isValidFarmTile) &&
    isLegacyNeighborsNoDog(save.neighbors) &&
    isValidEvents(save.events) &&
    typeof save.popularity === 'number' &&
    isValidGiftInbox(save.giftInbox)
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

// Pre-v9 saves had no guard dogs. Give legacy neighbors the same dog layout a
// fresh farm would get (first neighbor unguarded, the rest guarded) so the
// protection mechanic is visible immediately after migrating.
const withNeighborDogs = (neighbors: NeighborFarm[]): NeighborFarm[] =>
  neighbors.map((neighbor, index) => ({ ...neighbor, hasDog: index !== 0 }));

export class SaveSystem {
  createDefaultSave(): SaveGame {
    const now = Date.now();
    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      economy: createDefaultEconomy(),
      inventory: createDefaultInventory(),
      fertilizers: createDefaultInventory(),
      animals: createDefaultAnimals(),
      selectedCropId: defaultCropId,
      farmTiles: createDefaultFarmTiles(),
      neighbors: createNeighborFarms(now),
      events: [],
      popularity: 0,
      giftInbox: createStarterGifts(now),
      hasDog: false,
    };
  }

  saveGame(saveInput: {
    economy: PlayerEconomy;
    inventory: PlayerInventory;
    fertilizers: PlayerInventory;
    animals: PlayerAnimals;
    selectedCropId: string;
    farmTiles: FarmTile[];
    neighbors: NeighborFarm[];
    events: FarmEvent[];
    popularity: number;
    giftInbox: Gift[];
    hasDog: boolean;
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
      neighbors: saveInput.neighbors,
      events: saveInput.events,
      popularity: saveInput.popularity,
      giftInbox: saveInput.giftInbox,
      hasDog: saveInput.hasDog,
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

      // v8 only lacked the guard dogs (player.hasDog + neighbor.hasDog) in v9.
      if (isValidLegacySaveGameV8(parsed) && parsed.version === 8) {
        const migrated: SaveGame = {
          ...parsed,
          version: SAVE_VERSION,
          neighbors: withNeighborDogs(parsed.neighbors),
          hasDog: false,
        };
        this.saveGame(migrated);
        return migrated;
      }

      // v7 only lacked the prestige track (popularity + gift inbox) added in v8.
      if (isValidLegacySaveGameV7(parsed) && parsed.version === 7) {
        const migrated: SaveGame = {
          ...parsed,
          version: SAVE_VERSION,
          neighbors: withNeighborDogs(parsed.neighbors),
          popularity: 0,
          giftInbox: createStarterGifts(now),
          hasDog: false,
        };
        this.saveGame(migrated);
        return migrated;
      }

      // v6 only lacked the social state (neighbors + event log) added in v7.
      if (isValidLegacySaveGameV6(parsed) && parsed.version === 6) {
        const migrated: SaveGame = {
          ...parsed,
          version: SAVE_VERSION,
          neighbors: createNeighborFarms(now),
          events: [],
          popularity: 0,
          giftInbox: createStarterGifts(now),
          hasDog: false,
        };
        this.saveGame(migrated);
        return migrated;
      }

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
          neighbors: createNeighborFarms(now),
          events: [],
          popularity: 0,
          giftInbox: createStarterGifts(now),
          hasDog: false,
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
          neighbors: createNeighborFarms(now),
          events: [],
          popularity: 0,
          giftInbox: createStarterGifts(now),
          hasDog: false,
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
          neighbors: createNeighborFarms(now),
          events: [],
          popularity: 0,
          giftInbox: createStarterGifts(now),
          hasDog: false,
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
          neighbors: createNeighborFarms(now),
          events: [],
          popularity: 0,
          giftInbox: createStarterGifts(now),
          hasDog: false,
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
