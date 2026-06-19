import type { FarmTile } from './farm';

// Phase P4 social baseline.
//
// Neighbors are locally simulated NPC farms (no real multiplayer yet — the
// backend sync phase is deferred). They give the player somewhere to visit,
// help, and steal from so the classic social loop works fully offline. When a
// real friend backend lands, these can be swapped for real farms behind the
// same shape.

export type FarmEventKind = 'help' | 'steal' | 'system' | 'sabotage' | 'caught';

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
  // Phase P5: whether this farm is guarded by a dog. A guarded farm has a
  // chance to catch the player stealing or sabotaging and fine them.
  hasDog: boolean;
};

// Phase P4b: a flower gift sitting in the player's inbox. Collecting it raises
// the player's popularity (a social-prestige track separate from XP/level).
export type Gift = {
  id: string;
  fromName: string;
  flowerId: string;
  at: number; // epoch milliseconds
};
