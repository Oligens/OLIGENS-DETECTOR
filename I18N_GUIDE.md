# i18n Guide — Oligens Detector

This guide describes the i18n workflow used in the project, how translations are organized, and how to manage translations for deployment (Vercel).

1) Installed libraries

- `i18next`, `react-i18next`, `i18next-browser-languagedetector`

2) File structure

- `src/i18n/index.ts` — i18n initialization and language detector.
- `src/i18n/locales/*` — JSON translation files per language.
- `src/i18n/translations.csv` — canonical table for translators (key + languages).

3) Editing translations

- Preferred workflow:
  1. Edit `src/i18n/translations.csv` (add new keys or update translations).
  2. Generate JSON per-locale (script or manual conversion). Example Node script can parse CSV and write `src/i18n/locales/{code}.json`.

4) CSV format (header)

`key,en,fr,ht,es,de,it,pt,zh,ja,ar`

5) Using PO/CSV/POEditor

- Export `translations.csv` and import into POEditor or any localization platform.
- After translation, re-import CSV and convert to JSON files in `src/i18n/locales/`.

6) Geo-IP and manual override

- On first load the app calls `https://ipapi.co/json/` to detect country and map to a language.
- If user selects a language with the language selector, the choice is stored in `localStorage` and overrides automatic detection.

7) Vercel deployment notes

- Add the environment variables listed in `vercel.json` in the Vercel dashboard.
- The app is built with `vite build` and served as a static build by Vercel — ensure your SSR/API endpoints are compatible with Vercel or adapt to serverless functions.

8) Automation ideas (optional)

- Add an npm script to convert CSV to JSON and vice-versa:

```bash
node scripts/csv-to-json.js src/i18n/translations.csv src/i18n/locales/
```

9) Help / Next steps

- If you want I can add the CSV→JSON script and wire an npm script to automate locale generation. I can also create a POEditor import/export helper.
