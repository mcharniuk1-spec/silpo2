# silpo2 — Full Scraper (dairy)

Outputs:
- DB: `data/silpo.sqlite`
- Exports: `data/exports/latest.xlsx`, `data/exports/latest.csv`
- Logs: `data/logs/run_*.jsonl`
- HTML snapshots (only when challenge detected): `data/html_snapshots/*.html`

Run locally:
```bash
npm ci
npx playwright install chromium
npm run build
npm run start
