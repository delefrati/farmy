import type { PlayerEconomy } from '../types/economy';
import type { PlayerInventory } from '../types/inventory';

// Phase P6: daily systems and anti-abuse limits (client-side).
//
// Two mechanics live here, both reset on the local calendar day:
//   1. a daily login reward that cycles through a 5-day table (mirroring the
//      original Colheita Feliz daily reward of coins / seed / fertilizer / ...);
//   2. daily XP caps for the repetitive social actions (help and steal) so a
//      player cannot farm unlimited XP by spamming a friend's plots.
//
// The "server-side reset window / backend enforcement" half of the original
// design is intentionally deferred to the sync phase (P8); here the reset
// window is the player's local day and caps are enforced client-side.

export const DAILY = {
  // Daily XP a player can earn from helping friends before help stops paying.
  HELP_XP_CAP: 40,
  // Daily XP a player can earn from stealing before steals stop paying.
  STEAL_XP_CAP: 30,
  // Length of the rotating reward table (see DAILY_REWARD_CYCLE).
  REWARD_CYCLE_LENGTH: 5,
} as const;

export type DailyCapKind = 'help' | 'steal';

export type DailyState = {
  // Local calendar day (YYYY-MM-DD) of the last claimed reward, or null if the
  // player has never claimed one.
  lastClaimDate: string | null;
  // Consecutive-day claim streak as of lastClaimDate (1-based; 0 before any).
  streak: number;
  // Local calendar day the cap counters below belong to.
  capsDate: string;
  // XP earned from help actions on capsDate.
  helpXp: number;
  // XP earned from steal actions on capsDate.
  stealXp: number;
};

export type DailyReward =
  | { kind: 'coins'; amount: number; label: string }
  | { kind: 'item'; itemId: string; amount: number; label: string }
  | { kind: 'fertilizer'; fertilizerId: string; amount: number; label: string };

// Local calendar day key, e.g. '2026-05-01'. Using the local date (not UTC) so
// the reset window matches the player's own midnight.
export const dayKey = (now: number): string => {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const yesterdayKey = (now: number): string => dayKey(now - 24 * 60 * 60 * 1000);

export const createDailyState = (now: number): DailyState => ({
  lastClaimDate: null,
  streak: 0,
  capsDate: dayKey(now),
  helpXp: 0,
  stealXp: 0,
});

// Roll the cap counters over when the local day changes. Returns the same state
// object when still the same day, otherwise a copy with the counters reset.
export const rolloverDaily = (state: DailyState, now: number): DailyState => {
  const today = dayKey(now);
  if (state.capsDate === today) {
    return state;
  }
  return { ...state, capsDate: today, helpXp: 0, stealXp: 0 };
};

// The 5-day rotating reward table. Faithful to the original's "coins / seed /
// fertilizer / decoration / rare seed" idea, mapped onto this prototype's
// systems (planting costs coins directly, so seeds are granted as sellable
// produce; there is no decoration inventory yet, so that day grants coins).
export const DAILY_REWARD_CYCLE: DailyReward[] = [
  { kind: 'coins', amount: 25, label: '25 coins' },
  { kind: 'item', itemId: 'strawberry', amount: 2, label: '2 strawberries' },
  { kind: 'fertilizer', fertilizerId: 'fertilizer_normal', amount: 1, label: '1 Normal Fertilizer' },
  { kind: 'coins', amount: 40, label: '40 coins' },
  { kind: 'item', itemId: 'tomato', amount: 1, label: '1 tomato (rare)' },
];

// 1-based streak -> reward (cycles every DAILY_REWARD_CYCLE.length days).
export const rewardForStreak = (streak: number): DailyReward => {
  const index = (Math.max(1, streak) - 1) % DAILY_REWARD_CYCLE.length;
  return DAILY_REWARD_CYCLE[index];
};

export const isRewardAvailable = (state: DailyState, now: number): boolean =>
  state.lastClaimDate !== dayKey(now);

export type ClaimResult = {
  state: DailyState;
  reward: DailyReward;
  streak: number;
};

// Claim today's reward. Caller must check isRewardAvailable first. The streak
// continues if the previous claim was yesterday, otherwise it restarts at 1.
export const claimDailyReward = (state: DailyState, now: number): ClaimResult => {
  const today = dayKey(now);
  const continues = state.lastClaimDate === yesterdayKey(now);
  const streak = continues ? state.streak + 1 : 1;
  const reward = rewardForStreak(streak);
  return {
    state: { ...state, lastClaimDate: today, streak },
    reward,
    streak,
  };
};

// Apply a reward's effect to the player's economy / inventory / fertilizers.
export const applyDailyReward = (
  reward: DailyReward,
  economy: PlayerEconomy,
  inventory: PlayerInventory,
  fertilizers: PlayerInventory,
): void => {
  if (reward.kind === 'coins') {
    economy.coins += reward.amount;
  } else if (reward.kind === 'item') {
    inventory[reward.itemId] = (inventory[reward.itemId] ?? 0) + reward.amount;
  } else {
    fertilizers[reward.fertilizerId] = (fertilizers[reward.fertilizerId] ?? 0) + reward.amount;
  }
};

// XP still claimable today for a given social action before its cap is hit.
export const capRemaining = (state: DailyState, kind: DailyCapKind): number => {
  if (kind === 'help') {
    return Math.max(0, DAILY.HELP_XP_CAP - state.helpXp);
  }
  return Math.max(0, DAILY.STEAL_XP_CAP - state.stealXp);
};

// Record XP earned from a social action so the cap counter advances.
export const recordCapXp = (state: DailyState, kind: DailyCapKind, xp: number): DailyState => {
  if (kind === 'help') {
    return { ...state, helpXp: state.helpXp + xp };
  }
  return { ...state, stealXp: state.stealXp + xp };
};
