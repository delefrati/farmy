import type { DecorationDefinition } from '../types/decoration';

export const decorations: DecorationDefinition[] = [
  {
    id: 'flower_pot',
    name: 'Flower Pot',
    price: 28,
    unlockLevel: 2,
    color: 0x8f5ec9,
  },
  {
    id: 'wood_sign',
    name: 'Wood Sign',
    price: 46,
    unlockLevel: 3,
    color: 0x7a5a33,
  },
  {
    id: 'tree',
    name: 'Shade Tree',
    price: 60,
    unlockLevel: 3,
    color: 0x4f8f3a,
  },
  {
    id: 'flower_bed',
    name: 'Flower Bed',
    price: 75,
    unlockLevel: 4,
    color: 0xd76aa0,
  },
  {
    id: 'fence_post',
    name: 'Fence Post',
    price: 40,
    unlockLevel: 4,
    color: 0x9a6b3f,
  },
  {
    id: 'path_tile',
    name: 'Stone Path',
    price: 45,
    unlockLevel: 4,
    color: 0xb9ad94,
  },
  {
    id: 'lamp',
    name: 'Garden Lamp',
    price: 90,
    unlockLevel: 5,
    color: 0xd9a441,
  },
  {
    id: 'haystack',
    name: 'Hay Bales',
    price: 110,
    unlockLevel: 5,
    color: 0xe0b23c,
  },
  {
    id: 'pond',
    name: 'Pond',
    price: 150,
    unlockLevel: 6,
    color: 0x3f9fd0,
  },
  {
    id: 'well',
    name: 'Water Well',
    price: 180,
    unlockLevel: 6,
    color: 0x8a8f96,
  },
  {
    id: 'scarecrow',
    name: 'Scarecrow',
    price: 200,
    unlockLevel: 7,
    color: 0xc7892f,
  },
];

export const defaultDecorationId = decorations[0].id;
