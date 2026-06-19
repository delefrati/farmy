# Internationalization (i18n) Implementation Checklist

This checklist guides you through implementing multilingual support in Farmy.

## Phase 2.5: Setup i18n

### Frontend Setup

- [ ] Install i18n libraries:
  ```bash
  cd frontend
  npm install i18next react-i18next i18next-http-loader i18next-browser-languagedetector
  ```

- [ ] Create i18n config file: `src/i18n/config.ts`
  - Configure i18next with language detection
  - Set up HTTP backend for API translation loading
  - Configure fallback language (English)

- [ ] Create i18n hooks: `src/i18n/hooks.ts`
  - `useLanguage()` — Main language management hook
  - `useTranslate()` — Enhanced translation with error handling
  - Language support constants

- [ ] Create translation JSON files:
  - `frontend/locales/en.json` — English translations
  - `frontend/locales/pt-BR.json` — Portuguese (Brazil) translations

- [ ] Initialize i18n in app entry point:
  ```tsx
  import './i18n/config';
  ```

- [ ] Create language selector UI component
  - Display list of available languages
  - Allow user to switch languages
  - Show current language

### Backend Setup

- [ ] Run database migrations:
  ```bash
  cd backend
  npm run migrate
  ```
  Creates tables:
  - `languages` — Available languages
  - `translation_keys` — Unique translation strings
  - `translations` — Actual translated text

- [ ] Create translation API routes: `src/routes/translations.ts`
  - `GET /api/v1/translations/:lang/:namespace` — Fetch translations
  - `GET /api/v1/languages` — List available languages
  - `GET /api/v1/translations/stats/:lang` — Translation stats (admin)
  - `POST /api/v1/translations` — Create/update translation (admin)

- [ ] Create seed script: `src/db/seed-translations.ts`
  - Parse frontend JSON files
  - Insert translation keys into database
  - Populate translations for all languages

- [ ] Register translation routes in API:
  ```tsx
  import { createTranslationRoutes } from './routes/translations';
  app.use('/api/v1/translations', createTranslationRoutes(pool));
  ```

- [ ] Seed initial translations:
  ```bash
  npm run seed:translations
  ```

### Testing & Validation

- [ ] Verify database tables created:
  ```bash
  docker-compose exec postgres psql -U farmy_user -d farmy_db -c "\dt"
  ```

- [ ] Test translation API endpoint:
  ```bash
  curl http://localhost:3001/api/v1/translations/en/common
  ```

- [ ] Test language list endpoint:
  ```bash
  curl http://localhost:3001/api/v1/languages
  ```

- [ ] Load game in browser: http://localhost:5173
  - [ ] Game loads in browser's default language
  - [ ] Language selector is visible
  - [ ] Can switch to Portuguese (Brazil)
  - [ ] UI text updates when language changes
  - [ ] Language preference persists on page reload

### Documentation

- [ ] Create `I18N_GUIDE.md` with:
  - Setup instructions
  - API endpoint reference
  - How to add new translations
  - How to add new languages
  - Best practices
  - Troubleshooting

- [ ] Update main `README.md`:
  - Add i18n features to overview
  - Reference `I18N_GUIDE.md`
  - Document language support

- [ ] Update `doc/001-project.md`:
  - Add Section 4.5 for i18n strategy
  - Add Phase 2.5 for i18n implementation
  - Add Task 2.5 for i18n setup
  - Update commit order

## Phase 3+: Using i18n in Game Code

For each new UI string:

- [ ] Add key to both JSON files:
  - `frontend/locales/en.json`
  - `frontend/locales/pt-BR.json`

- [ ] Use in component:
  ```tsx
  import { useLanguage } from '@/i18n/hooks';

  function MyComponent() {
    const { t } = useLanguage();
    return <span>{t('namespace.key')}</span>;
  }
  ```

- [ ] Re-seed translations:
  ```bash
  npm run seed:translations
  ```

## Quick Commands

```bash
# Install dependencies
cd frontend && npm install i18next react-i18next i18next-http-loader i18next-browser-languagedetector

# Run database migrations
cd backend && npm run migrate

# Seed translations
npm run seed:translations

# Test API endpoint
curl http://localhost:3001/api/v1/translations/pt-BR/common

# Check translation stats
curl http://localhost:3001/api/v1/translations/stats/pt-BR
```

## Translation Keys Structure

Keys follow a hierarchical naming convention:

```
namespace.category.item

Examples:
  common.buttons.plant        — Button text
  crops.strawberry            — Crop name
  game.messages.welcome       — Game message
  errors.noFunds              — Error message
  ui.labels.level             — UI label
  decorations.fence           — Decoration name
  animals.chicken.product     — Animal product name
```

## Language Preference Flow

```
User visits game
  ↓
i18next detects language from:
  1. localStorage (previous choice)
  2. navigator.language (browser setting)
  3. HTML lang attribute
  ↓
Game loads translations from API or local files
  ↓
User selects different language
  ↓
localStorage updated
  ↓
UI re-renders with new language
  ↓
Next visit: Load saved language
```

## Adding a New Language (e.g., Spanish)

1. Create `frontend/locales/es.json` with all translations
2. Update `frontend/src/i18n/hooks.ts` — Add to `SUPPORTED_LANGUAGES`
3. Update `frontend/src/i18n/config.ts` — Add to resources
4. Insert language in database:
   ```sql
   INSERT INTO languages (code, name, native_name) 
   VALUES ('es', 'Spanish', 'Español');
   ```
5. Re-seed translations: `npm run seed:translations`

## Database Schema

### languages
```sql
id UUID PRIMARY KEY
code VARCHAR(10) UNIQUE        -- 'en', 'pt-BR', 'es'
name VARCHAR(50)               -- 'English', 'Portuguese (Brazil)'
native_name VARCHAR(50)        -- 'English', 'Português (Brasil)'
active BOOLEAN DEFAULT true
direction VARCHAR(10)          -- 'ltr' or 'rtl'
created_at TIMESTAMP
updated_at TIMESTAMP
```

### translation_keys
```sql
id UUID PRIMARY KEY
namespace VARCHAR(50)          -- 'common', 'game', 'crops'
key VARCHAR(255)               -- 'buttons.plant'
context VARCHAR(255)           -- Optional context
plural_form INT                -- 0=singular, 1=plural
description TEXT               -- Developer notes
created_at TIMESTAMP
updated_at TIMESTAMP
```

### translations
```sql
id UUID PRIMARY KEY
language_id UUID REFERENCES languages
key_id UUID REFERENCES translation_keys
value TEXT                     -- Actual translated text
is_translated BOOLEAN          -- Human reviewed?
translator_notes TEXT
last_updated_at TIMESTAMP
updated_by VARCHAR(255)
```

## Troubleshooting

**Problem:** Translations not loading
- Solution: Check `/api/v1/languages` responds
- Re-run: `npm run seed:translations`

**Problem:** Language doesn't persist
- Solution: Check browser allows localStorage
- Test: `localStorage.getItem('language')`

**Problem:** Missing translations show as keys
- Solution: Normal in development
- Add to JSON files and re-seed

**Problem:** API returns 404
- Solution: Verify backend is running: `curl http://localhost:3001/health`

## Resources

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)
- [Translation Management Best Practices](https://www.i18next.com/how-it-works)

## Notes

- Keep translation files in sync with database
- Always update both EN and PT-BR when adding strings
- Test language switching regularly
- Monitor missing translation warnings in console
- Consider translation budgets for new languages (time + cost)
