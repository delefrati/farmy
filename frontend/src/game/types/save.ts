import type { FarmTile } from './farm';
import type { PlayerEconomy } from './economy';
import type { PlayerInventory } from './inventory';
import type { PlayerAnimals } from './animals';
import type { FarmEvent, NeighborFarm } from './social';

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
};
