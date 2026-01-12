import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { config } from "./config.js";
import { RunLogger } from "./log.js";
import {
  openDb,
  insertRun,
  finishRun,
  insertProducts,
  insertPageLogs,
  insertEvents,
} from "./db.js";
import { scrapeSilpoCategory } from "./scrapers/silpoCategory.js";
import { exportAll } from "./export.js";

function ensureDirs() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.logsDir, { recursive: true });
  fs.mkdirSync(config.exportsDir, { recursive: true });
}

async function main() {
  ensureDirs();

  const runId = crypto.randomUUID();
  const logPath = path.join(
    config.logsDir,
    `run_${runId.slice(0, 8)}_${new Date()
      .toISOString()
      .replace(/[:.]/g, "")
      .slice(0, 15)}.jsonl`
  );
  const logger = new RunLogger(logPath);

  logger.info(
    "run_start",
    `runId=${runId} url=${config.categoryUrl} pages=${config.maxPages}`
  );

  const db = openDb(config.dbPath);
  insertRun(db, runId, config.categoryUrl, config.maxPages);

  let status = "OK";
  let note = "";

  try {
    const { products, pages } = await scrapeSilpoCategory(runId, logger);

    insertProducts(db, products);
    insertPageLogs(db, pages);
    insertEvents(db, runId, logger.events);

    logger.info(
      "db_written",
      `products=${products.length} pages=${pages.length} events=${logger.events.length}`
    );

    const { latestXlsx, latestCsv } = exportAll(
      db,
      config.exportsDir,
      runId,
      logger.events
    );
    logger.info("export_done", `xlsx=${latestXlsx} csv=${latestCsv}`);

    if (products.length === 0) {
      status = "ZERO";
      note = "zero_products_saved";
      logger.warn("zero_products", note);
    }
  } catch (e: any) {
    status = "ERROR";
    note = String(e?.message ?? e).slice(0, 300);
    logger.error("run_error", note);
  } finally {
    finishRun(db, runId, status, note);
    db.close();
  }

  logger.info("run_finish", `runId=${runId} status=${status} note=${note}`);
}

main().catch(console.error);
