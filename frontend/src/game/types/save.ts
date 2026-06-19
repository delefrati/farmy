import type { FarmTile } from './farm';
import type { PlayerEconomy } from './economy';
import type { PlayerInventory } from './inventory';
import type { PlayerAnimals } from './animals';
import type { FarmEvent, Gift, NeighborFarm } from './social';

export type SaveGame = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  inventory: PlayerInventory;
  fertilizers: PlayerInventory;
  animals: PlayerAnimals;
  selectedCropId: string;
  farmTiles: FarmTile[];
  // Phase P4 social baseline.
  neighbors: NeighborFarm[];
  events: FarmEvent[];
  // Phase P4b social prestige.
  popularity: number;
  giftInbox: Gift[];
  // Phase P5: whether the player has bought a guard dog for their own farm.
  hasDog: boolean;
};
