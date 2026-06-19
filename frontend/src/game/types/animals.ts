export type PlayerAnimals = {
  chickenCoops: number;
  eggs: number;
  lastEggTickAt: number;
};

export const createDefaultAnimals = (): PlayerAnimals => ({
  chickenCoops: 0,
  eggs: 0,
  lastEggTickAt: Date.now(),
});
