import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { JsonlLogger } from "../utils/logger";
import { fetchProductsViaApi } from "../utils/apiClient";
import type { Config } from "../config";
import type { Observation } from "../db";

function looksLikeChallenge(html: string, title: string) {
  const h = (html || "").toLowerCase();
  const t = (title || "").toLowerCase();
  return h.includes("just a moment") || h.includes("cf-challenge") || t.includes("just a moment");
}

function pageUrl(base: string, p: number) {
  return p === 1 ? base : `${base}?page=${p}`;
}

function parsePack(title: string): { qty: number | null; unit: string | null } {
  const t = (title || "").toLowerCase();
  let m = t.match(/(\d{1,2})\s*шт/);
  if (m) return { qty: Number(m[1]), unit: "шт" };
  m = t.match(/(\d+(?:[.,]\d+)?)\s*л\b/);
  if (m) return { qty: Math.round(Number(m[1].replace(",", ".")) * 1000), unit: "мл" };
  m = t.match(/(\d{2,4})\s*(г|мл)\b/);
  if (m) return { qty: Number(m[1]), unit: m[2] };
  m = t.match(/(\d+(?:[.,]\d+)?)\s*кг\b/);
  if (m) return { qty: Math.round(Number(m[1].replace(",", ".")) * 1000), unit: "г" };
  return { qty: null, unit: null };
}

function parsePrice(text: string): number | null {
  const m = (text || "").match(/(\d{1,4}(?:[.,]\d{2})?)\s*грн/i);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

export async function scrapeCategory(cfg: Config, runId: string, logger: JsonlLogger): Promise<Observation[]> {
  const out: Observation[] = [];
  fs.mkdirSync(cfg.htmlSnapshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: cfg.headless });
  const ctx = await browser.newContext({ locale: "uk-UA", viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(cfg.timeoutMs);

  for (let p = 1; p <= cfg.maxPages; p++) {
    const url = pageUrl(cfg.categoryUrl, p);
    logger.info("page_start", { runId, pageNumber: p, url });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle");

      const html = await page.content();
      const title = await page.title().catch(() => "");

      if (looksLikeChallenge(html, title)) {
        const snap = path.join(cfg.htmlSnapshotsDir, `challenge_${p}.html`);
        fs.writeFileSync(snap, html, "utf-8");
        logger.warn("challenge_detected", { runId, pageNumber: p, url, snapshot: snap, title });
        break;
      }

      // Strategy A: try __NEXT_DATA__
      const nextData = await page.evaluate(() => {
        const el = document.querySelector('script#__NEXT_DATA__');
        return el ? (el.textContent || "") : "";
      });

      let items: any[] = [];
      if (nextData) {
        try {
          const obj = JSON.parse(nextData);
          // heuristic walk is expensive in JS; do simple pick
          items = JSON.stringify(obj).includes("price") ? [obj] : [];
        } catch {
          items = [];
        }
      }

      // Strategy B: DOM parse product-like cards
      if (items.length === 0) {
        const cards = await page.evaluate(() => {
          const res: any[] = [];
          const blocks = Array.from(document.querySelectorAll("a[href]"));
          for (const a of blocks) {
            const href = (a.getAttribute("href") || "");
            if (!href.includes("/product") && !href.includes("/tovar") && !href.includes("/goods")) continue;
            const card = (a.closest("article, li, div") as HTMLElement) || (a as HTMLElement);
            const text = (card.innerText || "").trim();
            if (!text || text.length < 20) continue;
            res.push({ href, text: text.slice(0, 1500) });
            if (res.length >= 250) break;
          }
          return res;
        });

        for (const c of cards) {
          const price = parsePrice(c.text);
          if (price == null) continue;
          const titleLine = (c.text.split("\n")[0] || "").slice(0, 250);
          const pack = parsePack(titleLine);
          const href = typeof c.href === "string" && c.href.startsWith("/")
            ? `https://silpo.ua${c.href}`
            : (typeof c.href === "string" && c.href.startsWith("http") ? c.href : null);

          out.push({
            runId,
            observedAt: new Date().toISOString(),
            pageNo: p,
            pageUrl: url,
            title: titleLine,
            productUrl: href,
            brand: null,
            packQty: pack.qty,
            packUnit: pack.unit,
            priceCurrent: price,
            priceOld: null,
            discountPct: null,
            rawJson: null
          });
        }
      }

      // Strategy C: API fallback (best-effort)
      if (out.filter(x => x.pageNo === p).length === 0) {
        const api = await fetchProductsViaApi(cfg.apiCategoryId, p, 24);
        logger.info("api_attempt", { runId, pageNumber: p, url, ok: api.ok, status: api.status, items: api.items.length });

        for (const it of api.items) {
          const titleIt = String(it?.title ?? it?.name ?? "").slice(0, 250);
          const price = Number(it?.price ?? it?.currentPrice ?? it?.prices?.current ?? NaN);
          if (!titleIt || !Number.isFinite(price)) continue;
          const pack = parsePack(titleIt);

          out.push({
            runId,
            observedAt: new Date().toISOString(),
            pageNo: p,
            pageUrl: url,
            title: titleIt,
            productUrl: (typeof it?.url === "string" ? it.url : null),
            brand: (typeof it?.brand === "string" ? it.brand : null),
            packQty: pack.qty,
            packUnit: pack.unit,
            priceCurrent: price,
            priceOld: null,
            discountPct: null,
            rawJson: JSON.stringify(it)
          });
        }
      }

      const parsed = out.filter(x => x.pageNo === p).length;
      logger.info("page_done", { runId, pageNumber: p, url, itemsParsed: parsed });
      await page.waitForTimeout(1200);

    } catch (e: any) {
      logger.error("page_error", { runId, pageNumber: p, url, error: String(e?.message ?? e) });
      continue;
    }
  }

  await browser.close();
  return out;
}
