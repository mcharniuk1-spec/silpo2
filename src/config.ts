export const config = {
  // URL & pagination
  categoryUrl: process.env.SILPO_CATEGORY_URL ?? 
    "https://silpo.ua/category/molochni-produkty-ta-iaitsia-234",
  maxPages: Number(process.env.SILPO_MAX_PAGES ?? "10"),
  perPage: Number(process.env.SILPO_PER_PAGE ?? "24"),
  headless: (process.env.SILPO_HEADLESS ?? "true").toLowerCase() !== "false",
  timeoutMs: Number(process.env.SILPO_TIMEOUT_MS ?? "45000"),

  // Fallback
  useHtmlFallback: (process.env.SILPO_USE_HTML_FALLBACK ?? "true").toLowerCase() !== "false",
  useAltApi: (process.env.SILPO_USE_ALT_API ?? "true").toLowerCase() !== "false",

  // Outputs
  dataDir: process.env.SILPO_DATA_DIR ?? "data",
  dbPath: process.env.SILPO_DB_PATH ?? "data/silpo.sqlite",
  logsDir: process.env.SILPO_LOGS_DIR ?? "data/logs",
  exportsDir: process.env.SILPO_EXPORTS_DIR ?? "data/exports",

  // User-Agent
  userAgent: process.env.SILPO_USER_AGENT ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
