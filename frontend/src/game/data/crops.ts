import type { CropDefinition } from '../types/crop';

export const crops: CropDefinition[] = [
  {
    id: 'strawberry',
    name: 'Strawberry',
    seedPrice: 10,
    sellPrice: 25,
    growSeconds: 300,
    xp: 3,
    unlockLevel: 1,
    stages: ['seed', 'sprout', 'small', 'ready'],
  },
  {
    id: 'corn',
    name: 'Corn',
    seedPrice: 20,
    sellPrice: 55,
    growSeconds: 900,
    xp: 8,
    unlockLevel: 2,
    stages: ['seed', 'sprout', 'small', 'ready'],
  },
  {
    id: 'tomato',
    name: 'Tomato',
    seedPrice: 35,
    sellPrice: 90,
    growSeconds: 1800,
    xp: 15,
    unlockLevel: 3,
    stages: ['seed', 'sprout', 'small', 'ready'],
  },
];

export const defaultCropId = 'strawberry';
