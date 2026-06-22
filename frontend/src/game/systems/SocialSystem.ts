import { crops } from '../data/crops';
import type { CropDefinition } from '../types/crop';
import type { FarmTile } from '../types/farm';
import type { FarmEvent, FarmEventKind, Gift, NeighborFarm } from '../types/social';

export const SOCIAL = {
  // Reward for a single help action (water / weed / pest removal) on a friend.
  HELP_XP: 2,
  HELP_COINS: 1,
  // Reward for stealing one unit of a mature crop.
  STEAL_XP: 3,
  // Each mature crop can only be stolen a few times (owner keeps the rest).
  STEAL_LIMIT_PER_TILE: 3,
  // A single visit can only steal so much across the whole farm.
  STEAL_LIMIT_PER_VISIT: 5,
  // How many events to keep in the activity log.
  EVENT_LOG_CAP: 25,
  // Neighbor farm dimensions (smaller than the player's 6x4 field).
  NEIGHBOR_COLUMNS: 4,
  NEIGHBOR_ROWS: 3,
  // Phase P4b: popularity awarded when the player collects a received flower.
  POPULARITY_PER_GIFT: 5,
  // Small XP nudge for gifting a flower out to a neighbor.
  GIFT_OUT_XP: 1,
  // Phase P5: guard dog economy. Buying a dog protects the player's own farm;
  // visiting a guarded neighbor risks a fine when stealing or sabotaging.
  DOG_PRICE: 60,
  DOG_CATCH_CHANCE: 0.35,
  DOG_FINE: 15,
  // Love (friend-usable) fertilizer: how many of a neighbor's growing crops a
  // single visit can speed up. It is a friendly gesture, not a steal, so it is
  // capped separately and rewarded like a help action.
  LOVE_LIMIT_PER_VISIT: 3,
} as const;

// Phase P5 product flag. Sabotage (placing bugs/weeds on a friend's farm) is a
// negative interaction that can be turned off wholesale by flipping this flag.
export const SABOTAGE_ENABLED = true;

// Roll the guard dog's chance to catch the player in the act.
export const rollDogCatch = (): boolean => Math.random() < SOCIAL.DOG_CATCH_CHANCE;

// Small deterministic PRNG (mulberry32) so neighbor farms regenerate the same
// way for a given seed and never depend on Math.random.
const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const NEIGHBOR_NAMES = ['Maria', 'João', 'Ana'] as const;

// Texture key for a neighbor's round portrait, keyed by their generated id
// (`neighbor-<index>`). Falls back to the generic placeholder avatar.
const NEIGHBOR_AVATAR_KEYS = [
  'neighbor_avatar_maria',
  'neighbor_avatar_joao',
  'neighbor_avatar_ana',
] as const;

export const avatarKeyForNeighbor = (id: string): string => {
  const match = /^neighbor-(\d+)$/.exec(id);
  const index = match ? Number(match[1]) : -1;
  return NEIGHBOR_AVATAR_KEYS[index] ?? 'avatar_placeholder';
};

const pickCrop = (rng: () => number): CropDefinition => {
  const index = Math.floor(rng() * crops.length) % crops.length;
  return crops[index];
};

// Build a single neighbor farm with a deterministic mix of plot scenarios:
// some mature crops ready to steal, some growing crops carrying a problem the
// player can help with, and some healthy growing crops for variety.
const createNeighborFarm = (index: number, now: number): NeighborFarm => {
  const rng = mulberry32(0x9e3779b1 ^ (index * 0x85ebca77));
  const tiles: FarmTile[] = [];

  // Scenario plan per slot (left to right, top to bottom). Anything beyond the
  // plan is left as an empty plot.
  const plan: Array<'steal' | 'dry' | 'weeds' | 'pests' | 'growing'> = [
    'steal',
    'steal',
    'dry',
    'weeds',
    'pests',
    'growing',
    'steal',
    'growing',
  ];

  let slot = 0;
  for (let row = 0; row < SOCIAL.NEIGHBOR_ROWS; row += 1) {
    for (let col = 0; col < SOCIAL.NEIGHBOR_COLUMNS; col += 1) {
      const id = `neighbor-${index}-tile-${row}-${col}`;
      const scenario = plan[slot];
      slot += 1;

      if (!scenario) {
        tiles.push({ id, x: col, y: row, state: 'empty' });
        continue;
      }

      const crop = pickCrop(rng);
      const base: FarmTile = {
        id,
        x: col,
        y: row,
        state: 'planted',
        cropId: crop.id,
        health: 100,
        season: 1,
        careUpdatedAt: now,
        wateredAt: now,
      };

      if (scenario === 'steal') {
        // Already mature: plant far enough in the past to be ready.
        base.plantedAt = now - crop.growSeconds * 1000;
        base.stealRemaining = SOCIAL.STEAL_LIMIT_PER_TILE;
      } else {
        // Growing crop, roughly half-way, carrying one problem to help with.
        base.plantedAt = now - Math.floor(crop.growSeconds * 1000 * 0.5);
        if (scenario === 'dry') {
          base.isDry = true;
        } else if (scenario === 'weeds') {
          base.hasWeeds = true;
        } else if (scenario === 'pests') {
          base.hasPests = true;
        }
      }

      tiles.push(base);
    }
  }

  return {
    id: `neighbor-${index}`,
    name: NEIGHBOR_NAMES[index] ?? `Neighbor ${index + 1}`,
    tiles,
    // The first neighbor is left unguarded so stealing/sabotage can be tried
    // freely; the others keep a dog so the protection penalty is observable.
    hasDog: index !== 0,
  };
};

export const createNeighborFarms = (now: number): NeighborFarm[] => {
  return NEIGHBOR_NAMES.map((_, index) => createNeighborFarm(index, now));
};

let eventCounter = 0;
export const makeEventId = (): string => {
  eventCounter += 1;
  return `event_${Date.now().toString(36)}_${eventCounter.toString(36)}`;
};

// Prepend a new event and keep only the most recent EVENT_LOG_CAP entries.
export const pushEvent = (
  events: FarmEvent[],
  kind: FarmEventKind,
  message: string,
  now: number,
): FarmEvent[] => {
  const next: FarmEvent = { id: makeEventId(), at: now, kind, message };
  return [next, ...events].slice(0, SOCIAL.EVENT_LOG_CAP);
};

// Compact relative timestamp for the activity log ("just now", "5m ago", ...).
export const formatEventTime = (at: number, now: number): string => {
  const deltaSeconds = Math.max(0, Math.floor((now - at) / 1000));
  if (deltaSeconds < 10) {
    return 'just now';
  }
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
};

// Phase P4b gift helpers.

let giftCounter = 0;
export const makeGiftId = (): string => {
  giftCounter += 1;
  return `gift_${Date.now().toString(36)}_${giftCounter.toString(36)}`;
};

export const flowerCrops = (): CropDefinition[] => crops.filter((crop) => crop.isFlower);

export const isFlowerCrop = (cropId: string | undefined): boolean =>
  Boolean(cropId && crops.find((crop) => crop.id === cropId)?.isFlower);

export const makeGift = (fromName: string, flowerId: string, now: number): Gift => ({
  id: makeGiftId(),
  fromName,
  flowerId,
  at: now,
});

// Seed a couple of welcome gifts so a brand-new player can immediately see the
// popularity track react when they collect them.
export const createStarterGifts = (now: number): Gift[] => {
  const flowers = flowerCrops();
  if (flowers.length === 0) {
    return [];
  }
  return [
    makeGift('Maria', flowers[0].id, now),
    makeGift('Ana', flowers[Math.min(1, flowers.length - 1)].id, now),
  ];
};

