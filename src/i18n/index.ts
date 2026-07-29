import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fr from './locales/fr.json';
import ht from './locales/ht.json';
import es from './locales/es.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  ht: { translation: ht },
  es: { translation: es },
  de: { translation: de },
  it: { translation: it },
  pt: { translation: pt },
  zh: { translation: zh },
  ja: { translation: ja },
  ar: { translation: ar },
};

// Only use the browser language detector in a browser environment.
if (typeof window !== 'undefined') {
  i18n.use(LanguageDetector);
}

i18n.use(initReactI18next).init({
  resources,
  fallbackLng: 'fr',
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  detection: typeof window !== 'undefined' ? {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
  } : undefined,
});

export default i18n;
