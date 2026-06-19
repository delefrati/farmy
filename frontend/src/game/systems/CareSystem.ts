import type { FarmTile } from '../types/farm';

// Phase P1 — Crop care and failure states.
// All values are expressed in "growth seconds" so the dev growth speed scale
// (1x/10x/100x) affects care progression at the same rate as crop growth.
export const CARE = {
  MAX_HEALTH: 100,
  // Crop becomes dry this many scaled seconds after it was last watered.
  DRY_AFTER_SECONDS: 40,
  // Deterministic appearance schedule for weeds/pests.
  WEED_INTERVAL_SECONDS: 22,
  PEST_INTERVAL_SECONDS: 30,
  WEED_CHANCE: 0.55,
  PEST_CHANCE: 0.45,
  // Health changes per scaled second.
  HEALTH_DECAY_PER_PROBLEM_PER_SEC: 0.7,
  HEALTH_REGEN_PER_SEC: 0.25,
} as const;

// Deterministic hash → unit float in [0, 1). Using the tile id and interval
// index as the seed keeps weed/pest appearance reproducible across reloads.
const hashToUnit = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

export const ensureCareDefaults = (tile: FarmTile, now: number): void => {
  if (tile.state !== 'planted') {
    return;
  }

  const base = tile.plantedAt ?? now;
  if (typeof tile.health !== 'number') {
    tile.health = CARE.MAX_HEALTH;
  }
  if (typeof tile.wateredAt !== 'number') {
    tile.wateredAt = base;
  }
  if (typeof tile.careUpdatedAt !== 'number') {
    tile.careUpdatedAt = base;
  }
  if (typeof tile.weedIntervalSeen !== 'number') {
    tile.weedIntervalSeen = -1;
  }
  if (typeof tile.pestIntervalSeen !== 'number') {
    tile.pestIntervalSeen = -1;
  }
  tile.isDry = tile.isDry ?? false;
  tile.hasWeeds = tile.hasWeeds ?? false;
  tile.hasPests = tile.hasPests ?? false;
};

// Advances a planted tile's care state from the last evaluation to `now`.
// Safe to call repeatedly (idempotent between ticks) and after long gaps
// (e.g. when the game was closed), since it integrates over elapsed time.
export const simulateTileCare = (tile: FarmTile, now: number, scale: number): void => {
  if (tile.state !== 'planted' || !tile.plantedAt) {
    return;
  }

  ensureCareDefaults(tile, now);

  const careUpdatedAt = tile.careUpdatedAt ?? tile.plantedAt;
  const deltaSeconds = Math.max(0, (now - careUpdatedAt) / 1000) * scale;

  // Dryness derives purely from time since last watered.
  const drySeconds = Math.max(0, (now - (tile.wateredAt ?? tile.plantedAt)) / 1000) * scale;
  tile.isDry = drySeconds >= CARE.DRY_AFTER_SECONDS;

  const grownSeconds = Math.max(0, (now - tile.plantedAt) / 1000) * scale;

  // Weeds: deterministic roll once per crossed interval, sticky until removed.
  if (!tile.hasWeeds) {
    const weedInterval = Math.floor(grownSeconds / CARE.WEED_INTERVAL_SECONDS);
    if (weedInterval > (tile.weedIntervalSeen ?? -1)) {
      if (hashToUnit(`${tile.id}:weed:${weedInterval}`) < CARE.WEED_CHANCE) {
        tile.hasWeeds = true;
      }
      tile.weedIntervalSeen = weedInterval;
    }
  }

  // Pests: deterministic roll once per crossed interval, sticky until removed.
  if (!tile.hasPests) {
    const pestInterval = Math.floor(grownSeconds / CARE.PEST_INTERVAL_SECONDS);
    if (pestInterval > (tile.pestIntervalSeen ?? -1)) {
      if (hashToUnit(`${tile.id}:pest:${pestInterval}`) < CARE.PEST_CHANCE) {
        tile.hasPests = true;
      }
      tile.pestIntervalSeen = pestInterval;
    }
  }

  // Health decays while problems are unresolved, regenerates when cared for.
  const problems =
    (tile.isDry ? 1 : 0) + (tile.hasWeeds ? 1 : 0) + (tile.hasPests ? 1 : 0);
  let health = tile.health ?? CARE.MAX_HEALTH;
  if (problems > 0) {
    health -= problems * CARE.HEALTH_DECAY_PER_PROBLEM_PER_SEC * deltaSeconds;
  } else {
    health += CARE.HEALTH_REGEN_PER_SEC * deltaSeconds;
  }
  tile.health = Math.max(0, Math.min(CARE.MAX_HEALTH, health));

  tile.careUpdatedAt = now;
};

export const initTileCare = (tile: FarmTile, now: number): void => {
  tile.health = CARE.MAX_HEALTH;
  tile.isDry = false;
  tile.hasWeeds = false;
  tile.hasPests = false;
  tile.wateredAt = now;
  tile.careUpdatedAt = now;
  tile.weedIntervalSeen = -1;
  tile.pestIntervalSeen = -1;
};

export const clearTileCare = (tile: FarmTile): void => {
  tile.health = undefined;
  tile.isDry = undefined;
  tile.hasWeeds = undefined;
  tile.hasPests = undefined;
  tile.wateredAt = undefined;
  tile.careUpdatedAt = undefined;
  tile.weedIntervalSeen = undefined;
  tile.pestIntervalSeen = undefined;
};

export const waterTile = (tile: FarmTile, now: number): void => {
  tile.wateredAt = now;
  tile.isDry = false;
};

export const removeWeeds = (tile: FarmTile): void => {
  tile.hasWeeds = false;
};

export const removePests = (tile: FarmTile): void => {
  tile.hasPests = false;
};

export const getActiveProblems = (tile: FarmTile): string[] => {
  const problems: string[] = [];
  if (tile.hasPests) {
    problems.push('Pests');
  }
  if (tile.hasWeeds) {
    problems.push('Weeds');
  }
  if (tile.isDry) {
    problems.push('Dry');
  }
  return problems;
};
