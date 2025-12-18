import { CONFIG } from "./config.js";
import { ensureDir, safeFileName } from "./utils/fs.js";
import { JsonlLogger } from "./utils/logger.js";
import { openDb } from "./db/client.js";
import { ensureSchema } from "./db/schema.js";
import { insertRun, finishRun, insertPage, insertProducts, getRunProducts } from "./db/queries.js";
import { scrapeSilpoCategory } from "./scrapers/silpoCategory.js";
import { exportRowsToXlsx } from "./export/toXlsx.js";

function makeRunId(): string {
  // filesystem-safe ISO
  return safeFileName(new Date().toISOString());
}

async function main() {
  ensureDir("data");
  ensureDir(CONFIG.exportsDir);
  ensureDir(CONFIG.logsDir);

  const runId = makeRunId();
  const logger = new JsonlLogger(CONFIG.logsDir, runId);

  logger.info("START", "main", "run started", {
    runId,
    categoryUrl: CONFIG.categoryUrl,
    maxPages: CONFIG.maxPages,
    headless: CONFIG.headless
  });

  const db = openDb(CONFIG.dbPath);
  ensureSchema(db);

  const startedAt = new Date().toISOString();
  insertRun(db, {
    runId,
    startedAt,
    status: "STARTED",
    categoryUrl: CONFIG.categoryUrl,
    maxPages: CONFIG.maxPages
  });

  let status: "OK" | "FAILED" = "OK";
  let pagesProcessed = 0;
  let totalProducts = 0;
  let note: string | null = null;

  try {
    const { products, pages } = await scrapeSilpoCategory({
      runId,
      categoryUrl: CONFIG.categoryUrl,
      maxPages: CONFIG.maxPages,
      headless: CONFIG.headless,
      userAgent: CONFIG.userAgent,
      timezoneId: CONFIG.timezoneId,
      logger
    });

    for (const p of pages) insertPage(db, p);

    insertProducts(db, products);

    pagesProcessed = pages.length;
    totalProducts = products.length;

    logger.info("DB", "write", `pages=${pagesProcessed} products=${totalProducts}`);
  } catch (e: any) {
    status = "FAILED";
    note = e?.message ? String(e.message) : String(e);
    logger.error("ERROR", "main", "run failed", { error: note });
  } finally {
    const finishedAt = new Date().toISOString();
    finishRun(db, {
      runId,
      finishedAt,
      status,
      pagesProcessed,
      totalProducts,
      note
    });

    // Export XLSX from DB (even if FAILED -> may still have partial rows)
    const rows = getRunProducts(db, runId);

    const outXlsx = `${CONFIG.exportsDir}/silpo_products_${runId}.xlsx`;
    await exportRowsToXlsx({ rows, outPath: outXlsx, sheetName: "silpo_raw" });

    const latestXlsx = `${CONFIG.exportsDir}/latest.xlsx`;
    await exportRowsToXlsx({ rows, outPath: latestXlsx, sheetName: "silpo_raw" });

    logger.info("EXPORT", "xlsx", "export finished", { outXlsx, latestXlsx, rows: rows.length });

    db.close();
    logger.info("DONE", "main", `status=${status}`, { runId, log: logger.getLogPath() });
  }

  if (status === "FAILED") process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
