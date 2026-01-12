import Database from "better-sqlite3";

export type ProductRow = {
  runId: string;
  scrapedAt: string;
  pageUrl: string;
  pageNumber: number;
  source: string;
  productUrl: string | null;
  productId: string | null;
  title: string;
  brand: string | null;
  priceCurrent: number;
  priceOld: number | null;
  discountPct: number | null;
  rawJson: string | null;
};

export type PageLog = {
  runId: string;
  pageNumber: number;
  url: string;
  status: "OK" | "EMPTY" | "ERROR" | "CHALLENGE" | "API";
  httpStatus: number | null;
  itemsSeen: number;
  itemsParsed: number;
  error: string | null;
};

export type LogEvent = {
  ts: string;
  level: string;
  event: string;
  message: string;
};

export function openDb(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs(
      run_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      category_url TEXT NOT NULL,
      max_pages INTEGER NOT NULL,
      status TEXT NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS products(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      scraped_at TEXT NOT NULL,
      page_url TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      source TEXT NOT NULL,
      product_url TEXT,
      product_id TEXT,
      title TEXT NOT NULL,
      brand TEXT,
      price_current REAL,
      price_old REAL,
      discount_pct REAL,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS page_logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      page_url TEXT NOT NULL,
      status TEXT NOT NULL,
      http_status INTEGER,
      items_seen INTEGER NOT NULL,
      items_parsed INTEGER NOT NULL,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      level TEXT NOT NULL,
      event TEXT NOT NULL,
      message TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_run ON products(run_id);
    CREATE INDEX IF NOT EXISTS idx_pagelogs_run ON page_logs(run_id);
    CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
  `);

  return db;
}

export function insertRun(
  db: Database.Database,
  runId: string,
  categoryUrl: string,
  maxPages: number
) {
  db.prepare(
    `INSERT INTO runs(run_id, started_at, category_url, max_pages, status) VALUES(?, ?, ?, ?, ?)`
  ).run(runId, new Date().toISOString(), categoryUrl, maxPages, "RUNNING");
}

export function finishRun(
  db: Database.Database,
  runId: string,
  status: string,
  note: string
) {
  db.prepare(
    `UPDATE runs SET finished_at = ?, status = ?, note = ? WHERE run_id = ?`
  ).run(new Date().toISOString(), status, note, runId);
}

export function insertProducts(db: Database.Database, rows: ProductRow[]) {
  const stmt = db.prepare(`
    INSERT INTO products(
      run_id, scraped_at, page_url, page_number, source,
      product_url, product_id, title, brand,
      price_current, price_old, discount_pct, raw_json
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((items: ProductRow[]) => {
    for (const r of items) {
      stmt.run(
        r.runId, r.scrapedAt, r.pageUrl, r.pageNumber, r.source,
        r.productUrl, r.productId, r.title, r.brand,
        r.priceCurrent, r.priceOld, r.discountPct, r.rawJson
      );
    }
  });

  tx(rows);
}

export function insertPageLogs(db: Database.Database, logs: PageLog[]) {
  const stmt = db.prepare(`
    INSERT INTO page_logs(
      run_id, page_number, page_url, status, http_status,
      items_seen, items_parsed, error
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((items: PageLog[]) => {
    for (const l of items) {
      stmt.run(
        l.runId, l.pageNumber, l.url, l.status, l.httpStatus,
        l.itemsSeen, l.itemsParsed, l.error
      );
    }
  });

  tx(logs);
}

export function insertEvents(
  db: Database.Database,
  runId: string,
  events: LogEvent[]
) {
  const stmt = db.prepare(
    `INSERT INTO events(run_id, ts, level, event, message) VALUES(?, ?, ?, ?, ?)`
  );

  const tx = db.transaction((items: LogEvent[]) => {
    for (const e of items) {
      stmt.run(runId, e.ts, e.level, e.event, e.message);
    }
  });

  tx(events);
}
