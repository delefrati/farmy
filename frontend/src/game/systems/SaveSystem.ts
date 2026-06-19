import { createDefaultFarmTiles, GRID_COLUMNS, GRID_ROWS, type FarmTile } from '../types/farm';
import { createDefaultEconomy, type PlayerEconomy } from '../types/economy';
import { defaultCropId } from '../data/crops';
import type { SaveGame } from '../types/save';

const SAVE_KEY = 'farmy.save.v1';
const SAVE_VERSION = 1;

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
    (tile.state === 'empty' || tile.state === 'planted') &&
    (tile.cropId === undefined || typeof tile.cropId === 'string') &&
    (tile.plantedAt === undefined || typeof tile.plantedAt === 'number')
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
      selectedCropId: defaultCropId,
      farmTiles: createDefaultFarmTiles(),
    };
  }

  saveGame(saveInput: { economy: PlayerEconomy; selectedCropId: string; farmTiles: FarmTile[] }): SaveGame {
    const save: SaveGame = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      economy: saveInput.economy,
      selectedCropId: saveInput.selectedCropId,
      farmTiles: saveInput.farmTiles,
    };

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
