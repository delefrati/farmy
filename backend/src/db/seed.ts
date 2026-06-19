import { seedTranslations } from './seed-translations';

seedTranslations().then(() => {
  console.log('Seed completed.');
}).catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
