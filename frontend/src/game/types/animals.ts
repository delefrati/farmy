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
};

export type PlayerAnimals = {
  animals: AnimalState[];
};

export const createDefaultAnimals = (): PlayerAnimals => ({
  animals: [],
});
