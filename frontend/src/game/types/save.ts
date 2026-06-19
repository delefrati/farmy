import type { FarmTile } from './farm';
import type { PlayerEconomy } from './economy';

export type SaveGame = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  selectedCropId: string;
  farmTiles: FarmTile[];
};
