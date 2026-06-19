export type FarmTileState = 'empty' | 'planted';

export type FarmTile = {
  id: string;
  x: number;
  y: number;
  state: FarmTileState;
  cropId?: string;
  plantedAt?: number;
  decorationId?: string;
};

export const GRID_COLUMNS = 6;
export const GRID_ROWS = 4;

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
      });
    }
  }

  return tiles;
};
