export type CropDefinition = {
  id: string;
  name: string;
  seedPrice: number;
  sellPrice: number;
  growSeconds: number;
  xp: number;
  unlockLevel: number;
  stages: string[];
  // Number of harvest cycles before the plant is used up. Defaults to 1.
  seasons?: number;
};
