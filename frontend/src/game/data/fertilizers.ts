import type { FertilizerDefinition } from '../types/fertilizer';

// Inspired by the original Happy Farm / Colheita Feliz fertilizers, which
// reduced a crop's remaining wait time and could be applied only once per
// growth stage. Original reductions were 1h / 2h30 / 5h30 (ratio 1 : 2.5 : 5.5);
// the values below keep that ratio scaled to this game's short MVP timers.
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

// The "love" fertilizer is the friend-usable variant from the original game: it
// could not be bought with coins and was only ever applied to a friend's crops
// while visiting, speeding their remaining wait as a friendly gesture. It is
// intentionally kept OUT of the buyable `fertilizers` list so it never appears
// in the player's own coins-based fertilizer shop; only `NeighborScene` uses it.
export const loveFertilizer: FertilizerDefinition = {
  id: 'fertilizer_love',
  name: 'Love Fertilizer',
  price: 0,
  reduceSeconds: 60,
  unlockLevel: 1,
};
