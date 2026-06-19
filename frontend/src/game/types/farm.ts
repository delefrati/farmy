export type FarmTileState = 'empty' | 'planted' | 'dead';

export type FarmTile = {
  id: string;
  x: number;
  y: number;
  state: FarmTileState;
  cropId?: string;
  plantedAt?: number;
  decorationId?: string;
  // Phase P1 crop care state (all optional for backward-compatible saves)
  health?: number;
  isDry?: boolean;
  hasWeeds?: boolean;
  hasPests?: boolean;
  wateredAt?: number;
  careUpdatedAt?: number;
  weedIntervalSeen?: number;
  pestIntervalSeen?: number;
  // Phase P3 multi-season tracking (1-based current season).
  season?: number;
  // Phase P3 fertilizer: stage index that was last fertilized (one use/stage).
  fertilizedStage?: number;
  // Phase P4 social: how many units of a mature crop can still be stolen from
  // this tile (only used on neighbor farms).
  stealRemaining?: number;
  // Phase P5b land expansion: a locked plot cannot be planted/decorated until
  // the player unlocks it with coins (and sometimes a level). Undefined means
  // unlocked (keeps older saves backward compatible).
  locked?: boolean;
};

export const GRID_COLUMNS = 4;
export const GRID_ROWS = 6;

export const createDefaultFarmTiles = (): FarmTile[] => {
  const tiles: FarmTile[] = [];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLUMNS; col += 1) {
      tiles.push({
        id: `tile-${row}-${col}`,
        x: col,
        y: row,
        state: 'empty',
        cropId: undefined,
        plantedAt: undefined,
        decorationId: undefined,
        // Phase P5b: the bottom two rows start locked (kept in sync with
        // LandSystem.FIRST_LOCKED_ROW = 2; inlined here to avoid a cycle).
        locked: row >= 2,
      });
    }
  }

  return tiles;
};
