-- Translations and Language Management Tables

-- Languages table
CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  native_name VARCHAR(50),
  active BOOLEAN DEFAULT true,
  direction VARCHAR(10) DEFAULT 'ltr',  -- ltr or rtl (for future Arabic, Hebrew support)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Translation keys/strings
CREATE TABLE IF NOT EXISTS translation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(50) NOT NULL,  -- 'common', 'game', 'ui', 'crops', 'decorations'
  key VARCHAR(255) NOT NULL,       -- 'crops.strawberry', 'ui.buttons.plant'
  context VARCHAR(255),             -- Optional context (e.g., 'plural', 'female')
  plural_form INT,                  -- 0 = singular, 1 = plural, etc.
  description TEXT,                 -- Developer notes about this string
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(namespace, key, context, plural_form)
);

-- Actual translations
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  key_id UUID NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  is_translated BOOLEAN DEFAULT false,  -- Whether human translator has reviewed
  translator_notes TEXT,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255),  -- User/system that made the update
  UNIQUE(language_id, key_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_languages_code ON languages(code);
CREATE INDEX IF NOT EXISTS idx_languages_active ON languages(active);
CREATE INDEX IF NOT EXISTS idx_translation_keys_namespace ON translation_keys(namespace);
CREATE INDEX IF NOT EXISTS idx_translation_keys_key ON translation_keys(key);
CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language_id);
CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(key_id);
CREATE INDEX IF NOT EXISTS idx_translations_language_key ON translations(language_id, key_id);
CREATE INDEX IF NOT EXISTS idx_translations_is_translated ON translations(is_translated);

-- Insert default languages
INSERT INTO languages (code, name, native_name) VALUES
  ('en', 'English', 'English'),
  ('pt-BR', 'Portuguese (Brazil)', 'Português (Brasil)')
ON CONFLICT (code) DO NOTHING;
