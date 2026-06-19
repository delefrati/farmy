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
  // Phase P4b: flowers grow like crops but are primarily giftable (gifting a
  // flower to a neighbor feeds the popularity track).
  isFlower?: boolean;
};
