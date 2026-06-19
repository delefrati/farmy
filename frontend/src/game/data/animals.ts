import type { AnimalDefinition } from '../types/animal';

// Two animal categories from the original game (Colheita Feliz / Happy Farm):
// productive animals (feed -> produce -> collect -> sell) and growing animals
// (feed -> mature through stages -> sell). Original feed durations were 8h for
// producers and 12h for growers (ratio 2:3); scaled here to 120s:180s for the
// short MVP loop. Animals only advance while fed.
export const animalDefinitions: AnimalDefinition[] = [
  {
    id: 'chicken',
    name: 'Chicken',
    kind: 'productive',
    price: 80,
    unlockLevel: 2,
    feedPrice: 8,
    feedDurationSeconds: 120,
    productId: 'egg',
    productLabel: 'Eggs',
    produceSeconds: 30,
    produceCap: 6,
    productSellValue: 6,
  },
  {
    id: 'calf',
    name: 'Calf',
    kind: 'growing',
    price: 150,
    unlockLevel: 3,
    feedPrice: 12,
    feedDurationSeconds: 180,
    growSeconds: 300,
    growStages: ['Calf', 'Heifer', 'Cow'],
    sellValue: 320,
  },
];

export const getAnimalDefinition = (defId: string): AnimalDefinition | undefined =>
  animalDefinitions.find((def) => def.id === defId);
