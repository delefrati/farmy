import type { FarmTile } from '../types/farm';

// Phase P5b: land expansion. The field is a fixed 4x6 grid, but only the top
// two rows are usable at the start. The bottom rows begin locked and are
// unlocked one plot at a time with coins (the deeper rows also need a level),
// so the playable area grows over time the way the original farm expanded.
export const LAND = {
  // Rows at this index or below start locked on a fresh farm.
  FIRST_LOCKED_ROW: 2,
  // Row 2 (first locked row): cheaper, no level gate.
  ROW2_COST: 50,
  // Row 3 (deepest row): pricier and gated behind a level.
  ROW3_COST: 120,
  ROW3_LEVEL: 2,
  // Per-column surcharge so plots within a row are not all identical.
  ROW_COST_STEP: 10,
} as const;

// Whether a plot at the given row should start locked on a brand-new farm.
export const isRowLockedByDefault = (row: number): boolean => row >= LAND.FIRST_LOCKED_ROW;

// Coin cost and level requirement to unlock a specific locked plot.
export const plotUnlockInfo = (tile: FarmTile): { cost: number; level: number } => {
  if (tile.y >= 3) {
    return { cost: LAND.ROW3_COST + tile.x * LAND.ROW_COST_STEP, level: LAND.ROW3_LEVEL };
  }
  return { cost: LAND.ROW2_COST + tile.x * LAND.ROW_COST_STEP, level: 1 };
};
