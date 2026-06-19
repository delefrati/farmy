import type { FarmTile } from './farm';

// Phase P4 social baseline.
//
// Neighbors are locally simulated NPC farms (no real multiplayer yet — the
// backend sync phase is deferred). They give the player somewhere to visit,
// help, and steal from so the classic social loop works fully offline. When a
// real friend backend lands, these can be swapped for real farms behind the
// same shape.

export type FarmEventKind = 'help' | 'steal' | 'system';

export type FarmEvent = {
  id: string;
  at: number; // epoch milliseconds
  kind: FarmEventKind;
  message: string;
};

export type NeighborFarm = {
  id: string;
  name: string;
  tiles: FarmTile[];
};
