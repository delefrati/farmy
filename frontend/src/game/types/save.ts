import type { FarmTile } from './farm';
import type { PlayerEconomy } from './economy';
import type { PlayerInventory } from './inventory';

export type SaveGame = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  selectedCropId: string;
  farmTiles: FarmTile[];
};
