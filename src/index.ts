import fs from "fs";
import path from "path";
import crypto from "crypto";

import { loadConfig } from "./config";
import { JsonlLogger } from "./utils/logger";
import { openDb, insertRun, finishRun, insertObservations, fetchObservations } from "./db";
import { exportCsv, exportXlsx } from "./export";
import { scrapeCategory } from "./scrapers/silpoCategory";

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const cfg = loadConfig();
  fs.mkdirSync("data", { recursive: true });
  fs.mkdirSync(cfg.logsDir, { recursive: true });
  fs.mkdirSync(cfg.exportsDir, { recursive: true });

  const runId = crypto.randomUUID();
  const startedAt = nowIso();

  const logFile = path.join(cfg.logsDir, `run_${startedAt.replace(/[:\-]/g, "").slice(0, 15)}_${runId.slice(0, 8)}.jsonl`);
  const logger = new JsonlLogger(logFile);

  const db = openDb(cfg.dbPath);
  insertRun(db, {
    runId,
    startedAt,
    categoryUrl: cfg.categoryUrl,
    maxPages: cfg.maxPages,
    headless: cfg.headless ? 1 : 0,
    status: "RUNNING",
    notes: null
  });

  logger.info("run_start", { runId, categoryUrl: cfg.categoryUrl, maxPages: cfg.maxPages, headless: cfg.headless });

  let status = "OK";
  let notes: string | null = null;

  try {
    const obs = await scrapeCategory(cfg, runId, logger);
    insertObservations(db, obs);
    logger.info("db_written", { runId, observations: obs.length });

    const { header, rows } = fetchObservations(db, runId);
    const csvPath = exportCsv(cfg.exportsDir, header, rows);
    const xlsxPath = exportXlsx(cfg.exportsDir, header, rows);
    logger.info("export_done", { runId, csv: csvPath, xlsx: xlsxPath });

    if (rows.length === 0) {
      status = "ZERO";
      notes = "No observations extracted (challenge or empty payload).";
      logger.warn("zero_observations", { runId, notes });
    }
  } catch (e: any) {
    status = "ERROR";
    notes = String(e?.message ?? e);
    logger.error("run_error", { runId, error: notes });
  }

  finishRun(db, runId, nowIso(), status, notes);
  logger.info("run_finish", { runId, status, notes });

  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
