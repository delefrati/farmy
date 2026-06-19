# Internationalization (i18n) Guide

This document explains how to implement and manage multilingual support in Farmy.

## Overview

Farmy uses a **database-driven translation system** with client-side caching:

1. **Frontend** uses i18next to fetch and manage translations
2. **Backend** stores translations in PostgreSQL
3. **Redis** caches translations for fast access
4. **localStorage** stores user's language preference

## Supported Languages

- **English** (en) — Default language
- **Portuguese (Brazil)** (pt-BR) — First additional language

## Directory Structure

```
farmy/
├── frontend/
│   ├── src/
│   │   └── i18n/
│   │       ├── config.ts          # i18next configuration
│   │       └── hooks.ts           # Language management hooks
│   └── locales/
│       ├── en.json                # English translations
│       └── pt-BR.json             # Portuguese (Brazil) translations
├── backend/
│   ├── migrations/
│   │   └── 001_create_translations.sql   # Database schema
│   ├── src/
│   │   ├── routes/
│   │   │   └── translations.ts    # API endpoints
│   │   └── db/
│   │       └── seed-translations.ts   # Database seeding
└── doc/
    └── I18N_GUIDE.md              # This file
```

## Phase 2.5: Implementation Steps

### Step 1: Install Dependencies

```bash
cd frontend
npm install i18next react-i18next i18next-http-loader i18next-browser-languagedetector
npm install -D @types/i18next
```

### Step 2: Create Database Tables

Run migrations:

```bash
cd backend
npm run migrate
```

This creates:
- `languages` — Available languages
- `translation_keys` — Unique translation strings
- `translations` — Actual translated text

### Step 3: Seed Initial Translations

```bash
npm run seed:translations
```

This populates English and Portuguese translations from local JSON files.

### Step 4: Initialize i18next in Frontend

```tsx
// src/main.tsx or src/App.tsx
import './i18n/config';
import i18n from 'i18next';

// Wait for i18n to load before rendering
i18n.on('initialized', () => {
  ReactDOM.render(<App />, document.getElementById('root'));
});
```

### Step 5: Use Translations in Components

```tsx
import { useLanguage, useTranslate } from '@/i18n/hooks';

function GameUI() {
  const { t, currentLanguage, changeLanguage, supportedLanguages } = useLanguage();

  return (
    <div>
      {/* Display translated text */}
      <h1>{t('game.farm')}</h1>
      <p>{t('common.messages.welcome')}</p>

      {/* Language selector */}
      <select value={currentLanguage} onChange={(e) => changeLanguage(e.target.value as any)}>
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Step 6: Configure Backend API

Add translation routes to the API:

```tsx
// backend/src/index.ts
import { createTranslationRoutes } from './routes/translations';

const translationRoutes = createTranslationRoutes(pool);
app.use('/api/v1/translations', translationRoutes);
```

### Step 7: Test in Browser

1. Start all services: `docker-compose up -d`
2. Open http://localhost:5173
3. Check browser language is detected
4. Switch languages using the selector
5. Verify language preference persists in localStorage

## Adding New Translations

### In Frontend Code

When adding new UI text, use the translation key:

```tsx
// ❌ Don't do this:
<span>Plant Crop</span>

// ✅ Do this:
<span>{t('game.actions.plant')}</span>
```

### In JSON Files

Add to both `en.json` and `pt-BR.json`:

```json
{
  "game": {
    "actions": {
      "plant": "Plant Crop"
    }
  }
}
```

Portuguese:

```json
{
  "game": {
    "actions": {
      "plant": "Plantar Sementes"
    }
  }
}
```

### Update Database

Re-run seed script to populate new keys:

```bash
npm run seed:translations
```

Or manually insert via API:

```bash
curl -X POST http://localhost:53001/api/v1/translations \
  -H "Content-Type: application/json" \
  -d '{
    "language": "en",
    "namespace": "game",
    "key": "actions.plant",
    "value": "Plant Crop"
  }'
```

## API Endpoints

### Get Translations

```
GET /api/v1/translations/:lang/:namespace
```

Example:

```bash
curl http://localhost:53001/api/v1/translations/pt-BR/common
```

Response:

```json
{
  "success": true,
  "language": "pt-BR",
  "namespace": "common",
  "translations": {
    "buttons.plant": "Plantar",
    "buttons.harvest": "Colher",
    "crops.strawberry": "Morango"
  }
}
```

### List Languages

```
GET /api/v1/languages
```

Response:

```json
{
  "success": true,
  "languages": [
    { "id": "uuid", "code": "en", "name": "English", "native_name": "English", "active": true },
    { "id": "uuid", "code": "pt-BR", "name": "Portuguese (Brazil)", "native_name": "Português (Brasil)", "active": true }
  ]
}
```

### Get Translation Stats

```
GET /api/v1/translations/stats/:lang
```

Example:

```bash
curl http://localhost:53001/api/v1/translations/stats/pt-BR
```

Response:

```json
{
  "success": true,
  "language": "pt-BR",
  "stats": {
    "total": 145,
    "translated": 145,
    "missing": 0,
    "percentageComplete": 100
  }
}
```

### Create/Update Translation (Admin)

```
POST /api/v1/translations
```

Payload:

```json
{
  "language": "pt-BR",
  "namespace": "crops",
  "key": "strawberry",
  "value": "Morango"
}
```

## Hooks and Utilities

### useLanguage()

Main hook for language management:

```tsx
const {
  currentLanguage,        // Current language code
  changeLanguage,         // Function to change language
  supportedLanguages,     // Array of available languages
  getCurrentLanguageInfo, // Get info about current language
  getLanguageName,        // Get translated language name
  t,                      // Translation function
  i18n                    // i18next instance
} = useLanguage();
```

### useTranslate()

Wrapper for translation with better error handling:

```tsx
const t = useTranslate();
const text = t('crops.strawberry'); // "Strawberry" or "Morango"
```

## Language Detection

The frontend auto-detects language in this order:

1. **localStorage** — If user has previously selected a language
2. **Browser language** — navigator.language (e.g., `pt-BR`, `en-US`)
3. **Default** — Falls back to English (`en`)

Example detection flow:

```
User's browser language is pt-BR
↓
localStorage has no saved language
↓
Auto-detect: pt-BR
↓
Game loads in Portuguese
↓
User switches to English
↓
Save to localStorage: 'language' = 'en'
↓
Next visit: Load English
```

## Fallback Strategy

When a translation is missing:

1. Try to load from current language (e.g., `pt-BR`)
2. If not found, try English fallback
3. If still not found, display the translation key (e.g., `crops.strawberry`)

Example:

```tsx
t('crops.unknownCrop') // Returns 'crops.unknownCrop' if missing
```

Development console shows warnings:

```
⚠️ Translation missing for key: crops.unknownCrop
```

## Adding a New Language (Future)

To add Spanish (es) support:

### 1. Create Language File

Create `frontend/locales/es.json`:

```json
{
  "common": {
    "buttons": {
      "plant": "Plantar",
      "harvest": "Cosechar"
    }
  }
}
```

### 2. Update i18n Config

```tsx
// frontend/src/i18n/config.ts
import esTranslations from '../locales/es.json';

const resources = {
  en: { common: enTranslations },
  'pt-BR': { common: ptBRTranslations },
  es: { common: esTranslations },  // Add this
};
```

### 3. Update Hooks

```tsx
// frontend/src/i18n/hooks.ts
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },  // Add this
];
```

### 4. Create Language in Database

```bash
curl -X POST http://localhost:53001/api/v1/languages \
  -H "Content-Type: application/json" \
  -d '{
    "code": "es",
    "name": "Spanish",
    "nativeName": "Español"
  }'
```

Or via SQL:

```sql
INSERT INTO languages (code, name, native_name) 
VALUES ('es', 'Spanish', 'Español');
```

### 5. Seed Spanish Translations

```bash
npm run seed:translations
```

## Best Practices

### Do's ✅

- Always use `t()` function for all user-facing text
- Keep translation keys organized (e.g., `game.crops.strawberry`)
- Use short, descriptive key names
- Test both English and Portuguese regularly
- Keep translation JSON files in sync with code
- Use context variables for dynamic text: `t('game.harvest', { cropName: 'Strawberry' })`

### Don'ts ❌

- Don't hardcode strings in components
- Don't use translations from props without falling back
- Don't mix English and Portuguese in the same file
- Don't forget to update both JSON files when adding translations
- Don't add language-specific logic (let i18n handle it)

## Troubleshooting

### Translations Not Loading

1. Check browser console for errors
2. Verify API is running: `curl http://localhost:53001/api/v1/languages`
3. Check database tables exist: `docker-compose exec postgres psql -U farmy_user -d farmy_db -c "\dt"`
4. Re-seed translations: `npm run seed:translations`

### Language Doesn't Persist

1. Check localStorage: `localStorage.getItem('language')`
2. Verify browser allows localStorage (not in private/incognito mode)
3. Check for CORS issues in browser console

### Missing Translations Show as Keys

This is normal during development. Add translations to JSON files and re-seed.

To find all missing translations:

```bash
curl http://localhost:53001/api/v1/translations/stats/pt-BR
```

## Performance Considerations

- Translations are cached in Redis on the backend
- Client-side caching in localStorage reduces API calls
- Bundle size impact: ~15KB gzipped for i18next + plugins

## Next Steps

- [x] Set up database schema
- [x] Create i18next config
- [x] Implement language selector UI
- [ ] Translate all game text to Portuguese
- [ ] Add admin panel for translators
- [ ] Implement right-to-left (RTL) support (if adding Arabic)
- [ ] Add more languages (Spanish, French, etc.)
