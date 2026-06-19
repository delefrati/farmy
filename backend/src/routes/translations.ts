/**
 * Translation API Routes
 * Handles fetching and managing translations
 */

import express, { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function createTranslationRoutes(pool: Pool): Router {
  const router = express.Router();

  /**
   * GET /api/v1/translations/:lang/:namespace
   * Fetch all translations for a given language and namespace
   * 
   * Example: GET /api/v1/translations/pt-BR/common
   * Response: {
   *   "crops.strawberry": "Morango",
   *   "crops.corn": "Milho",
   *   ...
   * }
   */
  router.get('/:lang/:namespace', async (req: Request, res: Response) => {
    try {
      const { lang, namespace } = req.params;

      // Validate language code
      const langResult = await pool.query(
        'SELECT id FROM languages WHERE code = $1 AND active = true',
        [lang]
      );

      if (langResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Language not found',
        });
      }

      const languageId = langResult.rows[0].id;

      // Fetch all translations for this language and namespace
      const translationsResult = await pool.query(
        `SELECT 
          tk.key,
          tk.plural_form,
          t.value
        FROM translations t
        INNER JOIN translation_keys tk ON t.key_id = tk.id
        INNER JOIN languages l ON t.language_id = l.id
        WHERE l.id = $1 AND tk.namespace = $2
        ORDER BY tk.key`,
        [languageId, namespace]
      );

      // Format response as key-value pairs
      const translations: Record<string, string> = {};
      translationsResult.rows.forEach((row) => {
        const key = row.plural_form ? `${row.key}_${row.plural_form}` : row.key;
        translations[key] = row.value;
      });

      // Cache for 1 hour
      res.set('Cache-Control', 'public, max-age=3600');

      res.json({
        success: true,
        language: lang,
        namespace,
        translations,
        count: translationsResult.rows.length,
      });
    } catch (err) {
      console.error('Error fetching translations:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch translations',
      });
    }
  });

  /**
   * GET /api/v1/languages
   * Fetch list of available languages
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT id, code, name, native_name, active FROM languages ORDER BY name'
      );

      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.json({
        success: true,
        languages: result.rows,
      });
    } catch (err) {
      console.error('Error fetching languages:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch languages',
      });
    }
  });

  /**
   * GET /api/v1/translations/stats/:lang
   * Get translation statistics for a language
   * (How many strings are translated vs. missing)
   */
  router.get('/stats/:lang', async (req: Request, res: Response) => {
    try {
      const { lang } = req.params;

      const result = await pool.query(
        `SELECT 
          COUNT(*) as total_strings,
          SUM(CASE WHEN t.value IS NOT NULL THEN 1 ELSE 0 END) as translated,
          SUM(CASE WHEN t.value IS NULL THEN 1 ELSE 0 END) as missing
        FROM translation_keys tk
        LEFT JOIN translations t ON tk.id = t.key_id
        LEFT JOIN languages l ON l.id = t.language_id AND l.code = $1`,
        [lang]
      );

      const stats = result.rows[0];
      const percentageTranslated = stats.total_strings
        ? Math.round((stats.translated / stats.total_strings) * 100)
        : 0;

      res.json({
        success: true,
        language: lang,
        stats: {
          total: parseInt(stats.total_strings),
          translated: parseInt(stats.translated || 0),
          missing: parseInt(stats.missing || 0),
          percentageComplete: percentageTranslated,
        },
      });
    } catch (err) {
      console.error('Error fetching translation stats:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch translation stats',
      });
    }
  });

  /**
   * POST /api/v1/translations (Admin only)
   * Create or update a translation
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      // TODO: Add authentication/authorization check
      // if (!req.user?.isAdmin) {
      //   return res.status(403).json({ success: false, error: 'Unauthorized' });
      // }

      const { language, namespace, key, value, context, pluralForm } = req.body;

      if (!language || !namespace || !key || !value) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      // Get or create translation key
      const keyResult = await pool.query(
        `INSERT INTO translation_keys (namespace, key, context, plural_form, description)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (namespace, key, context, plural_form) DO UPDATE SET updated_at = NOW()
        RETURNING id`,
        [namespace, key, context || null, pluralForm || 0, null]
      );

      const keyId = keyResult.rows[0].id;

      // Get language ID
      const langResult = await pool.query(
        'SELECT id FROM languages WHERE code = $1',
        [language]
      );

      if (langResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Language not found' });
      }

      const languageId = langResult.rows[0].id;

      // Create or update translation
      const updateResult = await pool.query(
        `INSERT INTO translations (language_id, key_id, value, is_translated, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (language_id, key_id) DO UPDATE SET 
          value = EXCLUDED.value,
          last_updated_at = NOW()
        RETURNING *`,
        [languageId, keyId, value, true, req.user?.username || 'api']
      );

      res.json({
        success: true,
        translation: updateResult.rows[0],
      });
    } catch (err) {
      console.error('Error creating/updating translation:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to create/update translation',
      });
    }
  });

  return router;
}
