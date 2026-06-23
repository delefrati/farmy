import type { AnimalDefinition } from '../types/animal';
import type { AnimalState } from '../types/animals';

export const ANIMAL = {
  FEED_XP: 1,
  COLLECT_XP_PER_PRODUCT: 2,
  SELL_XP_DIVISOR: 12,
  // How long (in scaled "fed-equivalent" seconds) an animal may stay hungry
  // before it starves to death. Generous so a freshly-bought, not-yet-fed
  // animal doesn't die before the player gets a chance to feed it.
  STARVE_SECONDS: 600,
} as const;

let idCounter = 0;

export const makeAnimalId = (): string => {
  idCounter += 1;
  return `animal_${Date.now().toString(36)}_${idCounter}`;
};

export const createAnimalInstance = (defId: string, now: number): AnimalState => ({
  id: makeAnimalId(),
  defId,
  // New animals start hungry; the player must feed them to begin progress.
  fedUntil: now,
  lastTickAt: now,
  storedProduct: 0,
  produceProgressMs: 0,
  growthMs: 0,
  matured: false,
  starveMs: 0,
  dead: false,
});

export const isFed = (state: AnimalState, now: number): boolean =>
  !state.dead && state.fedUntil > now;

export const isDead = (state: AnimalState): boolean => state.dead === true;

export const foodRemainingSeconds = (state: AnimalState, now: number): number =>
  Math.max(0, (state.fedUntil - now) / 1000);

// Extend the fed window. Feeding while already fed stacks onto the remaining
// duration, matching the original's feed-to-refill behavior.
export const feedAnimal = (state: AnimalState, def: AnimalDefinition, now: number): void => {
  if (state.dead) {
    return;
  }
  const base = Math.max(state.fedUntil, now);
  state.fedUntil = base + def.feedDurationSeconds * 1000;
  // Feeding clears accumulated hunger, resetting the starvation clock.
  state.starveMs = 0;
};

// Deterministic, timestamp-based advance. Only the portion of elapsed time
// during which the animal was fed contributes to production/growth, so the
// simulation is correct even after the game was closed. The dev growth scale
// accelerates progress (not feed consumption) to match crop dev-speed.
export const simulateAnimal = (
  state: AnimalState,
  def: AnimalDefinition,
  now: number,
  timeScale: number,
): void => {
  if (state.dead) {
    state.lastTickAt = now;
    return;
  }
  if (now <= state.lastTickAt) {
    state.lastTickAt = now;
    return;
  }

  const fedEnd = Math.min(now, state.fedUntil);
  const fedElapsedMs = Math.max(0, fedEnd - state.lastTickAt) * timeScale;
  // Time spent hungry (after the fed window ran out) within this tick.
  const hungryStart = Math.max(state.lastTickAt, state.fedUntil);
  const hungryElapsedMs = Math.max(0, now - hungryStart) * timeScale;
  state.lastTickAt = now;

  if (hungryElapsedMs > 0) {
    state.starveMs = (state.starveMs ?? 0) + hungryElapsedMs;
    if (state.starveMs >= ANIMAL.STARVE_SECONDS * 1000) {
      state.dead = true;
      return;
    }
  }

  if (fedElapsedMs <= 0) {
    return;
  }

  if (def.kind === 'productive') {
    const perMs = (def.produceSeconds ?? 0) * 1000;
    const cap = def.produceCap ?? 0;
    if (perMs <= 0 || cap <= 0) {
      return;
    }

    state.produceProgressMs += fedElapsedMs;
    while (state.produceProgressMs >= perMs && state.storedProduct < cap) {
      state.storedProduct += 1;
      state.produceProgressMs -= perMs;
    }

    if (state.storedProduct >= cap) {
      // Full: stop accumulating until the player collects.
      state.produceProgressMs = 0;
    }
    return;
  }

  // Growing animal.
  if (state.matured) {
    return;
  }

  const growMs = (def.growSeconds ?? 0) * 1000;
  if (growMs <= 0) {
    return;
  }

  state.growthMs += fedElapsedMs;
  if (state.growthMs >= growMs) {
    state.growthMs = growMs;
    state.matured = true;
  }
};

export const getGrowthFraction = (state: AnimalState, def: AnimalDefinition): number => {
  const growMs = (def.growSeconds ?? 0) * 1000;
  if (growMs <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, state.growthMs / growMs));
};

export const getGrowthStageLabel = (state: AnimalState, def: AnimalDefinition): string => {
  const stages = def.growStages ?? [];
  if (stages.length === 0) {
    return state.matured ? 'Mature' : 'Growing';
  }
  if (state.matured) {
    return stages[stages.length - 1];
  }
  const fraction = getGrowthFraction(state, def);
  const index = Math.min(Math.floor(fraction * stages.length), stages.length - 1);
  return stages[index];
};
