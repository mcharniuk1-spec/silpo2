# Silpo.ua Scraper (TypeScript + Playwright)

Full dairy/eggs product scraper for Silpo.ua using Node.js 20+, TypeScript, Playwright, and SQLite.

## Features

- **DOM + API fallback**: Direct scraping with API discovery
- **Cloudflare detection**: Challenge detection and safe exit
- **3-tier persistence**: SQLite (history) + XLSX (readable) + CSV (analytics)
- **Structured logging**: JSONL file + Excel logs sheet
- **Environment configurable**: All settings via env vars

## Installation

```bash
npm ci
npx playwright install --with-deps chromium
