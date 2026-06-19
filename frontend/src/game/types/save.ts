import type { FarmTile } from './farm';

export type SaveGame = {
  version: number;
  savedAt: string;
  farmTiles: FarmTile[];
};
