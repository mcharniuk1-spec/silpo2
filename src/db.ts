import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export type Observation = {
  runId: string;
  observedAt: string;
  pageNo: number;
  pageUrl: string;
  title?: string | null;
  productUrl?: string | null;
  brand?: string | null;
  packQty?: number | null;
  packUnit?: string | null;
  priceCurrent?: number | null;
  priceOld?: number | null;
  discountPct?: number | null;
  rawJson?: string | null;
};

export function openDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      category_url TEXT NOT NULL,
      max_pages INTEGER NOT NULL,
      headless INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      page_no INTEGER NOT NULL,
      page_url TEXT NOT NULL,
      title TEXT,
      product_url TEXT,
      brand TEXT,
      pack_qty REAL,
      pack_unit TEXT,
      price_current REAL,
      price_old REAL,
      discount_pct REAL,
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_obs_run ON observations(run_id);
  `);
  return db;
}

export function insertRun(db: Database.Database, run: any) {
  db.prepare(`
    INSERT INTO runs(run_id, started_at, category_url, max_pages, headless, status, notes)
    VALUES(@runId, @startedAt, @categoryUrl, @maxPages, @headless, @status, @notes)
  `).run(run);
}

export function finishRun(db: Database.Database, runId: string, finishedAt: string, status: string, notes: string | null) {
  db.prepare(`
    UPDATE runs SET finished_at=?, status=?, notes=? WHERE run_id=?
  `).run(finishedAt, status, notes, runId);
}

export function insertObservations(db: Database.Database, rows: Observation[]) {
  const stmt = db.prepare(`
    INSERT INTO observations(
      run_id, observed_at, page_no, page_url,
      title, product_url, brand, pack_qty, pack_unit,
      price_current, price_old, discount_pct, raw_json
    ) VALUES(
      @runId, @observedAt, @pageNo, @pageUrl,
      @title, @productUrl, @brand, @packQty, @packUnit,
      @priceCurrent, @priceOld, @discountPct, @rawJson
    )
  `);

  const tx = db.transaction((items: Observation[]) => {
    for (const r of items) stmt.run(r);
  });
  tx(rows);
}

export function fetchObservations(db: Database.Database, runId: string) {
  const rows = db.prepare(`
    SELECT observed_at, page_no, page_url, title, product_url, brand,
           pack_qty, pack_unit, price_current, price_old, discount_pct
    FROM observations
    WHERE run_id=?
    ORDER BY page_no, title
  `).all(runId);

  const header = Object.keys(rows[0] ?? {
    observed_at: "", page_no: "", page_url: "", title: "", product_url: "", brand: "",
    pack_qty: "", pack_unit: "", price_current: "", price_old: "", discount_pct: ""
  });

  return { header, rows };
}
