import type { FertilizerDefinition } from '../types/fertilizer';

// Inspired by the original Happy Farm / Colheita Feliz fertilizers, which
// reduced a crop's remaining wait time and could be applied only once per
// growth stage. Original reductions were 1h / 2h30 / 5h30 (ratio 1 : 2.5 : 5.5);
// the values below keep that ratio scaled to this game's short MVP timers.
// The "love" (friend-usable) fertilizer is intentionally deferred to the
// social phase (P4).
export const fertilizers: FertilizerDefinition[] = [
  {
    id: 'fertilizer_normal',
    name: 'Normal Fertilizer',
    price: 15,
    reduceSeconds: 30,
    unlockLevel: 1,
  },
  {
    id: 'fertilizer_fast',
    name: 'Fast Fertilizer',
    price: 35,
    reduceSeconds: 75,
    unlockLevel: 2,
  },
  {
    id: 'fertilizer_super',
    name: 'Super Fertilizer',
    price: 80,
    reduceSeconds: 165,
    unlockLevel: 3,
  },
];

export const defaultFertilizerId = 'fertilizer_normal';
