export type AnimalState = {
  id: string;
  defId: string;
  // Timestamp until which the animal is fed. Production/growth only advances
  // during fed time.
  fedUntil: number;
  lastTickAt: number;
  // Productive animals: products waiting to be collected and accumulated
  // fed-time toward the next product.
  storedProduct: number;
  produceProgressMs: number;
  // Growing animals: accumulated fed-time toward maturity.
  growthMs: number;
  matured: boolean;
  // Hunger accumulated (scaled) since food last ran out. Reset on feed. Once it
  // crosses the starvation threshold the animal dies. Optional so old saves
  // (without the field) stay valid and load as "no hunger yet".
  starveMs?: number;
  // Set once the animal has starved to death. A dead animal stops producing /
  // growing, can't be fed, and shows the "deceased" sprite until removed.
  dead?: boolean;
};

export type PlayerAnimals = {
  animals: AnimalState[];
};

export const createDefaultAnimals = (): PlayerAnimals => ({
  animals: [],
});
