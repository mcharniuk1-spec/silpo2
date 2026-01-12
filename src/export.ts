import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import Database from "better-sqlite3";

export function exportAll(
  db: Database.Database,
  exportsDir: string,
  runId: string,
  events: any[]
) {
  fs.mkdirSync(exportsDir, { recursive: true });

  const products = db
    .prepare(
      `
    SELECT scraped_at, page_url, page_number, source, product_url, product_id,
           title, brand, price_current, price_old, discount_pct
    FROM products WHERE run_id = ? ORDER BY page_number, title
  `
    )
    .all(runId);

  const pageLogs = db
    .prepare(
      `
    SELECT page_number, page_url, status, http_status, items_seen, items_parsed, error
    FROM page_logs WHERE run_id = ? ORDER BY page_number
  `
    )
    .all(runId);

  const ws1 = XLSX.utils.json_to_sheet(products);
  const ws2 = XLSX.utils.json_to_sheet(pageLogs);
  const ws3 = XLSX.utils.json_to_sheet(events);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "products");
  XLSX.utils.book_append_sheet(wb, ws2, "page_logs");
  XLSX.utils.book_append_sheet(wb, ws3, "logs");

  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .slice(0, 15);
  const xlsxPath = path.join(exportsDir, `silpo_${ts}_${runId.slice(0, 8)}.xlsx`);
  const latestXlsx = path.join(exportsDir, "latest.xlsx");

  XLSX.writeFile(wb, xlsxPath);
  XLSX.writeFile(wb, latestXlsx);

  // CSV (products only)
  const csv = XLSX.utils.sheet_to_csv(ws1);
  const latestCsv = path.join(exportsDir, "latest.csv");
  fs.writeFileSync(latestCsv, csv, "utf-8");

  return { latestXlsx, latestCsv };
}
