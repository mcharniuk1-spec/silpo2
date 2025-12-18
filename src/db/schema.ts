import type Database from "better-sqlite3";

export function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      category_url TEXT NOT NULL,
      max_pages INTEGER NOT NULL,
      pages_processed INTEGER NOT NULL DEFAULT 0,
      total_products INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL,
      http_status INTEGER,
      items_seen INTEGER NOT NULL DEFAULT 0,
      items_parsed INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES runs(run_id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      scraped_at TEXT NOT NULL,

      page_url TEXT NOT NULL,
      page_number INTEGER NOT NULL,

      source TEXT NOT NULL,
      product_url TEXT NOT NULL,

      title TEXT NOT NULL,
      brand TEXT,
      product_type TEXT,
      fat_pct TEXT,

      pack_qty REAL,
      pack_unit TEXT,

      price_current REAL NOT NULL,
      price_old REAL,
      discount_pct TEXT,

      price_per_unit REAL,
      rating REAL,

      price_type TEXT NOT NULL,

      FOREIGN KEY(run_id) REFERENCES runs(run_id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_run ON products(run_id);
    CREATE INDEX IF NOT EXISTS idx_pages_run ON pages(run_id);
  `);
}
