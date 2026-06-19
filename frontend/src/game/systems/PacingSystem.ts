// Phase P7: economy parity tuning — pacing profiles.
//
// The MVP uses very short crop timers (seconds) so the loop can be tested
// quickly. The original Happy Farm / Colheita Feliz used long, hours-to-days
// timers. A pacing profile is a single global multiplier on how long every
// timed process takes (crop growth, care problems, crop death, fertilizer
// reduction, animal growth). Picking a profile shifts the absolute pace of the
// whole game without changing the *relative* efficiency of crops against each
// other (every duration scales by the same factor).
//
// The profile composes with the existing dev growth-speed override: the dev
// speed makes time run faster for testing, the profile sets the design-intent
// baseline. The combined effective scale used by the simulation is
//   effectiveScale = devGrowthSpeed / profile.growthMultiplier

export type PacingProfileId = 'dev-fast' | 'nostalgia';

export type PacingProfile = {
  id: PacingProfileId;
  name: string;
  // Multiplier applied to every base duration. 1 keeps the MVP-fast timers;
  // larger values stretch all timers toward the original's hours-long pacing.
  growthMultiplier: number;
  description: string;
};

export const pacingProfiles: PacingProfile[] = [
  {
    id: 'dev-fast',
    name: 'Dev / MVP (fast)',
    growthMultiplier: 1,
    description: 'Short MVP timers (seconds) for quick testing of the full loop.',
  },
  {
    id: 'nostalgia',
    name: 'Nostalgia (original-like)',
    // 40x turns the ~90s starter crop into ~1 hour, matching the original's
    // hours-long maturity feel while keeping the dev-speed override usable.
    growthMultiplier: 40,
    description: 'Long, original-like timers (a starter crop takes about an hour at 1x dev speed).',
  },
];

export const defaultPacingProfileId: PacingProfileId = 'dev-fast';

export const getPacingProfile = (id: PacingProfileId): PacingProfile =>
  pacingProfiles.find((profile) => profile.id === id) ?? pacingProfiles[0];

export const isPacingProfileId = (value: unknown): value is PacingProfileId =>
  value === 'dev-fast' || value === 'nostalgia';

// Combine a pacing profile with the dev growth-speed override into the single
// scale value the simulation passes around (higher = faster real-time).
export const effectiveGrowthScale = (devGrowthSpeed: number, profileId: PacingProfileId): number =>
  devGrowthSpeed / getPacingProfile(profileId).growthMultiplier;

// Base-second duration stretched by the profile (used for display only).
export const effectiveSeconds = (baseSeconds: number, profileId: PacingProfileId): number =>
  baseSeconds * getPacingProfile(profileId).growthMultiplier;
