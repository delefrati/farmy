/**
 * Database Seed Script for Translations
 * Populates languages and initial translation keys
 * 
 * Run with: npm run seed:translations
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import enTranslations from '../../../frontend/locales/en.json';
import ptBRTranslations from '../../../frontend/locales/pt-BR.json';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface TranslationData {
  [key: string]: string | TranslationData;
}

/**
 * Flatten nested translation objects into key-value pairs
 * Example: { crops: { strawberry: 'Strawberry' } } => { 'crops.strawberry': 'Strawberry' }
 */
function flattenTranslations(obj: TranslationData, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenTranslations(value, fullKey));
    }
  }

  return result;
}

export async function seedTranslations() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get or create languages
    await client.query(
      'INSERT INTO languages (code, name, native_name) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING id',
      ['en', 'English', 'English']
    );

    await client.query(
      'INSERT INTO languages (code, name, native_name) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING id',
      ['pt-BR', 'Portuguese (Brazil)', 'Português (Brasil)']
    );

    // Get language IDs
    const enLangResult = await client.query('SELECT id FROM languages WHERE code = $1', ['en']);
    const ptbrLangResult = await client.query('SELECT id FROM languages WHERE code = $1', ['pt-BR']);

    const enLanguageId = enLangResult.rows[0].id;
    const ptbrLanguageId = ptbrLangResult.rows[0].id;

    // Flatten translations
    const enFlat = flattenTranslations(enTranslations);
    const ptbrFlat = flattenTranslations(ptBRTranslations);

    console.log(`📝 Found ${Object.keys(enFlat).length} English translation keys`);
    console.log(`📝 Found ${Object.keys(ptbrFlat).length} Portuguese translation keys`);

    // Infer namespace from key (first part before dot)
    const getNamespace = (key: string) => {
      const parts = key.split('.');
      return parts[0] || 'common';
    };

    // Insert translation keys and values
    let insertedCount = 0;

    for (const [key, enValue] of Object.entries(enFlat)) {
      const namespace = getNamespace(key);

      // Insert or get translation key
      const keyResult = await client.query(
        `INSERT INTO translation_keys (namespace, key, plural_form)
         VALUES ($1, $2, 0)
         ON CONFLICT (namespace, key, context, plural_form) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [namespace, key]
      );

      const keyId = keyResult.rows[0].id;

      // Insert English translation
      await client.query(
        `INSERT INTO translations (language_id, key_id, value, is_translated)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (language_id, key_id) DO UPDATE SET value = EXCLUDED.value`,
        [enLanguageId, keyId, enValue]
      );

      // Insert Portuguese translation (if exists)
      const ptbrValue = ptbrFlat[key];
      if (ptbrValue) {
        await client.query(
          `INSERT INTO translations (language_id, key_id, value, is_translated)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (language_id, key_id) DO UPDATE SET value = EXCLUDED.value`,
          [ptbrLanguageId, keyId, ptbrValue]
        );
      }

      insertedCount++;
    }

    await client.query('COMMIT');

    console.log(`✅ Seeded ${insertedCount} translation keys`);
    console.log('✅ Inserted English and Portuguese (Brazil) translations');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding translations:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedTranslations().then(() => {
    console.log('✅ Seed completed successfully');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
}
