import type Database from "better-sqlite3";
import type { PageLog, ProductRow, RunStatus } from "../types.js";

export function insertRun(db: Database.Database, run: {
  runId: string;
  startedAt: string;
  status: RunStatus;
  categoryUrl: string;
  maxPages: number;
}) {
  const stmt = db.prepare(`
    INSERT INTO runs (run_id, started_at, status, category_url, max_pages)
    VALUES (@runId, @startedAt, @status, @categoryUrl, @maxPages)
  `);
  stmt.run(run);
}

export function finishRun(db: Database.Database, run: {
  runId: string;
  finishedAt: string;
  status: RunStatus;
  pagesProcessed: number;
  totalProducts: number;
  note?: string | null;
}) {
  const stmt = db.prepare(`
    UPDATE runs
    SET finished_at=@finishedAt,
        status=@status,
        pages_processed=@pagesProcessed,
        total_products=@totalProducts,
        note=@note
    WHERE run_id=@runId
  `);
  stmt.run({ note: null, ...run });
}

export function insertPage(db: Database.Database, p: PageLog) {
  const stmt = db.prepare(`
    INSERT INTO pages (
      run_id, page_number, url, status, http_status, items_seen, items_parsed, error, created_at
    ) VALUES (
      @runId, @pageNumber, @url, @status, @httpStatus, @itemsSeen, @itemsParsed, @error, @createdAt
    )
  `);
  stmt.run({
    ...p,
    createdAt: new Date().toISOString()
  });
}

export function insertProducts(db: Database.Database, rows: ProductRow[]) {
  if (rows.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO products (
      run_id, scraped_at,
      page_url, page_number,
      source, product_url,
      title, brand, product_type, fat_pct,
      pack_qty, pack_unit,
      price_current, price_old, discount_pct,
      price_per_unit, rating,
      price_type
    ) VALUES (
      @runId, @scrapedAt,
      @pageUrl, @pageNumber,
      @source, @productUrl,
      @title, @brand, @productType, @fatPct,
      @packQty, @packUnit,
      @priceCurrent, @priceOld, @discountPct,
      @pricePerUnit, @rating,
      @priceType
    )
  `);

  const tx = db.transaction((items: ProductRow[]) => {
    for (const r of items) stmt.run(r);
  });
  tx(rows);
}

export function getRunProducts(db: Database.Database, runId: string): any[] {
  const stmt = db.prepare(`
    SELECT
      scraped_at as upload_ts,
      page_url,
      page_number,
      source,
      title as product_title,
      brand,
      product_type,
      fat_pct,
      pack_qty,
      pack_unit,
      price_current,
      price_old,
      discount_pct,
      price_per_unit as price_per_l_or_kg_or_piece,
      rating,
      price_type,
      product_url
    FROM products
    WHERE run_id = ?
    ORDER BY page_number ASC, id ASC
  `);
  return stmt.all(runId);
}
