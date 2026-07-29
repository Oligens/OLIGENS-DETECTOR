import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ht', label: 'Kreyòl', flag: '🇭🇹' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const change = (code: string) => {
    i18n.changeLanguage(code);
    try {
      localStorage.setItem('oligens_lang', code);
    } catch {}
    // update html dir for RTL
    try {
      document.documentElement.lang = code;
      document.documentElement.dir = i18n.dir(code);
    } catch {}
  };

  return (
    <div className="inline-flex items-center gap-2">
      <select
        value={i18n.language}
        onChange={(e) => change(e.target.value)}
        className="rounded-full bg-white/5 text-white/80 px-3 py-1"
        aria-label="Language selector"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
