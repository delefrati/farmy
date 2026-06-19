import { createDefaultFarmTiles, GRID_COLUMNS, GRID_ROWS, type FarmTile } from '../types/farm';
import type { SaveGame } from '../types/save';

const SAVE_KEY = 'farmy.save.v1';
const SAVE_VERSION = 1;

const isValidFarmTile = (value: unknown): value is FarmTile => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tile = value as Partial<FarmTile>;
  return (
    typeof tile.id === 'string' &&
    typeof tile.x === 'number' &&
    typeof tile.y === 'number' &&
    (tile.state === 'empty' || tile.state === 'planted')
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
      farmTiles: createDefaultFarmTiles(),
    };
  }

  saveGame(farmTiles: FarmTile[]): SaveGame {
    const save: SaveGame = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      farmTiles,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return save;
  }

  loadGame(): SaveGame {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const initial = this.createDefaultSave();
      this.saveGame(initial.farmTiles);
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
    this.saveGame(fallback.farmTiles);
    return fallback;
  }

  clearSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
