import type { FarmTile } from './farm';
import type { PlayerEconomy } from './economy';
import type { PlayerInventory } from './inventory';
import type { PlayerAnimals } from './animals';

export type SaveGame = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  animals: PlayerAnimals;
  selectedCropId: string;
  farmTiles: FarmTile[];
};
