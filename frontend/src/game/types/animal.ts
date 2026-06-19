export type AnimalKind = 'productive' | 'growing';

export type AnimalDefinition = {
  id: string;
  name: string;
  kind: AnimalKind;
  price: number;
  unlockLevel: number;
  // Feeding: how much one feed costs and how long it lasts.
  feedPrice: number;
  feedDurationSeconds: number;
  // Productive animals only: produce an item on a timer while fed.
  productId?: string;
  productLabel?: string;
  produceSeconds?: number;
  produceCap?: number;
  productSellValue?: number;
  // Growing animals only: mature through stages, then sell for coins.
  growSeconds?: number;
  growStages?: string[];
  sellValue?: number;
};
