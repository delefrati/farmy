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
];

export const defaultDecorationId = decorations[0].id;
