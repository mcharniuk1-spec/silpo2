import { chromium } from "playwright";
import type { JsonlLogger } from "../utils/logger.js";
import type { PageLog, ProductRow } from "../types.js";
import {
  extractDiscount,
  extractFat,
  extractPack,
  extractPrices,
  inferBrand,
  inferProductType,
  computePricePerUnit,
  normalizeTitle
} from "../parsers/silpoParser.js";

function pageUrl(categoryUrl: string, p: number): string {
  return p === 1 ? categoryUrl : `${categoryUrl}?page=${p}`;
}

function looksAntiBot(title: string, bodySnippet: string): boolean {
  const t = (title || "").toLowerCase();
  const b = (bodySnippet || "").toLowerCase();
  return t.includes("just a moment") || b.includes("just a moment") || b.includes("cf-browser-verification");
}

export async function scrapeSilpoCategory(params: {
  runId: string;
  categoryUrl: string;
  maxPages: number;
  headless: boolean;
  userAgent: string;
  timezoneId: string;
  logger: JsonlLogger;
}): Promise<{ products: ProductRow[]; pages: PageLog[] }> {
  const { runId, categoryUrl, maxPages, headless, userAgent, timezoneId, logger } = params;

  const browser = await chromium.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    userAgent,
    locale: "uk-UA",
    timezoneId,
    viewport: { width: 1365, height: 768 },
    extraHTTPHeaders: {
      "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache"
    }
  });

  // Faster + more stable: block images/fonts
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    return route.continue();
  });

  const page = await context.newPage();

  const products: ProductRow[] = [];
  const pages: PageLog[] = [];

  try {
    for (let p = 1; p <= maxPages; p++) {
      const url = pageUrl(categoryUrl, p);

      logger.info("FETCH", `page_${p}`, "goto", { url });

      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const httpStatus = resp?.status() ?? null;

      await page.waitForTimeout(1500);

      const title = await page.title();
      const bodySnippet = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || "");

      if (httpStatus === 403 || looksAntiBot(title, bodySnippet)) {
        const pl: PageLog = {
          runId,
          pageNumber: p,
          url,
          status: "BLOCKED",
          httpStatus,
          itemsSeen: 0,
          itemsParsed: 0,
          error: `Anti-bot detected (title="${title}", status=${httpStatus})`
        };
        pages.push(pl);
        logger.error("BLOCKED", `page_${p}`, pl.error!, { url });
        throw new Error(pl.error!);
      }

      // Extract candidate product anchors (DOM-based, not raw HTML regex)
      const items = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href^="/product/"]')) as HTMLAnchorElement[];
        const seen = new Set<string>();
        const out: Array<{ href: string; text: string }> = [];

        for (const a of anchors) {
          const txt = (a.innerText || "").replace(/\s+/g, " ").trim();
          const href = a.getAttribute("href") || "";
          if (!href || !txt) continue;
          if (!txt.includes("грн")) continue;
          const key = href + "::" + txt.slice(0, 100);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ href, text: txt });
        }
        return out;
      });

      let parsed = 0;

      for (const it of items) {
        const discountPct = extractDiscount(it.text);
        const prices = extractPrices(it.text);
        if (!prices.current) continue;

        const titleNorm = normalizeTitle(it.text);
        if (!titleNorm || titleNorm.length < 5) continue;

        const brand = inferBrand(titleNorm);
        const productType = inferProductType(titleNorm);
        const pack = extractPack(titleNorm);
        const fatPct = extractFat(titleNorm, discountPct);

        const priceOld = discountPct ? prices.old : null;
        const priceType = discountPct ? "discount" : "regular";
        const pricePerUnit = computePricePerUnit(prices.current, pack.qty, pack.unit);

        const productUrl = new URL(it.href, "https://silpo.ua").toString();

        products.push({
          runId,
          scrapedAt: new Date().toISOString(),
          pageUrl: url,
          pageNumber: p,
          source: "https://silpo.ua",
          productUrl,
          title: titleNorm,
          brand,
          productType,
          fatPct,
          packQty: pack.qty,
          packUnit: pack.unit,
          priceCurrent: prices.current,
          priceOld,
          discountPct,
          pricePerUnit,
          rating: null,
          priceType
        });

        parsed += 1;
      }

      const status: PageLog["status"] = parsed === 0 ? "EMPTY" : "OK";
      const pl: PageLog = {
        runId,
        pageNumber: p,
        url,
        status,
        httpStatus,
        itemsSeen: items.length,
        itemsParsed: parsed,
        error: null
      };
      pages.push(pl);

      logger.info("PARSE", `page_${p}`, `items_seen=${items.length} items_parsed=${parsed}`, { url });

      if (parsed > 0) {
        const s = products[products.length - parsed];
        logger.info("SAMPLE", `page_${p}`, `${s.title} | ${s.priceCurrent} грн`, { productUrl: s.productUrl });
      }
    }

    return { products, pages };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
