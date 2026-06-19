export type FertilizerDefinition = {
  id: string;
  name: string;
  price: number;
  // Growth-seconds removed from the remaining wait when applied.
  reduceSeconds: number;
  unlockLevel: number;
};
