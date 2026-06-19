import type { CropDefinition } from '../types/crop';

export const crops: CropDefinition[] = [
  {
    id: 'strawberry',
    name: 'Strawberry',
    seedPrice: 10,
    sellPrice: 16,
    growSeconds: 90,
    xp: 4,
    unlockLevel: 1,
    stages: ['seed', 'sprout', 'small', 'ready'],
  },
  {
    id: 'corn',
    name: 'Corn',
    seedPrice: 24,
    sellPrice: 44,
    growSeconds: 240,
    xp: 10,
    unlockLevel: 2,
    stages: ['seed', 'sprout', 'small', 'ready'],
  },
  {
    id: 'tomato',
    name: 'Tomato',
    seedPrice: 42,
    sellPrice: 86,
    growSeconds: 480,
    xp: 18,
    unlockLevel: 3,
    stages: ['seed', 'sprout', 'small', 'ready'],
  },
];

export const defaultCropId = 'strawberry';
