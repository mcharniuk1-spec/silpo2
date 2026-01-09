export type Config = {
  categoryUrl: string;
  maxPages: number;
  headless: boolean;
  timeoutMs: number;
  dbPath: string;
  logsDir: string;
  exportsDir: string;
  htmlSnapshotsDir: string;
  apiCategoryId: number; // fallback API (best-effort)
};

export function loadConfig(): Config {
  return {
    categoryUrl:
      process.env.SILPO_CATEGORY_URL ??
      "https://silpo.ua/category/molochni-produkty-ta-iaitsia-234",
    maxPages: Number(process.env.SILPO_MAX_PAGES ?? "10"),
    headless: (process.env.SILPO_HEADLESS ?? "true").toLowerCase() === "true",
    timeoutMs: Number(process.env.SILPO_TIMEOUT_MS ?? "60000"),
    dbPath: process.env.SILPO_DB_PATH ?? "data/silpo.sqlite",
    logsDir: process.env.SILPO_LOGS_DIR ?? "data/logs",
    exportsDir: process.env.SILPO_EXPORTS_DIR ?? "data/exports",
    htmlSnapshotsDir: process.env.SILPO_HTML_SNAPSHOTS_DIR ?? "data/html_snapshots",
    apiCategoryId: Number(process.env.SILPO_API_CATEGORY_ID ?? "234") // best guess
  };
}
