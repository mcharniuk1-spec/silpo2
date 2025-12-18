# Silpo Full Scraper (category → SQLite → XLSX)

Primary storage: `data/silpo.sqlite` (all runs & products).
Exports: `data/exports/*.xlsx` + `data/exports/latest.xlsx`.
Logs: `data/logs/*.jsonl`.

## Run locally
```bash
npm ci
npx playwright install chromium
npm run scrape
