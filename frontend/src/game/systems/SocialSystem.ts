import { crops } from '../data/crops';
import type { CropDefinition } from '../types/crop';
import type { FarmTile } from '../types/farm';
import type { FarmEvent, FarmEventKind, NeighborFarm } from '../types/social';

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
} as const;

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
