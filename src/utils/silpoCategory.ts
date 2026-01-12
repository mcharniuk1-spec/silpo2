import { chromium } from "playwright";
import { fetchProductsViaApi } from "../utils/apiClient.js";
import type { ProductRow, PageLog } from "../db.js";
import { config } from "../config.js";
import type { RunLogger } from "../log.js";

function pageUrl(p: number): string {
  return p === 1 ? config.categoryUrl : `${config.categoryUrl}?page=${p}`;
}

function looksLikeChallenge(html: string, title: string): boolean {
  const h = html.toLowerCase();
  const t = (title || "").toLowerCase();
  return (
    h.includes("just a moment") ||
    h.includes("cf-challenge") ||
    t.includes("just a moment")
  );
}

function extractPriceAndTitle(text: string): {
  title: string;
  price: number | null;
} | null {
  // Find price in format "NNN,NN грн"
  const priceMatch = text.match(/(\\d{1,4}(?:[.,]\\d{2})?)\\s*грн/i);
  if (!priceMatch) return null;

  const price = Number(priceMatch[1].replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) return null;

  // Title is first line
  const title = text.split("\\n")[0].trim().slice(0, 240);
  if (!title) return null;

  return { title, price };
}

export async function scrapeSilpoCategory(runId: string, logger: RunLogger) {
  const products: ProductRow[] = [];
  const pages: PageLog[] = [];

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ locale: "uk-UA" });
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeoutMs);

  try {
    for (let p = 1; p <= config.maxPages; p++) {
      const url = pageUrl(p);
      logger.info("page_start", `page=${p} url=${url}`);

      let httpStatus: number | null = null;
      let parsed = 0;
      let status: PageLog["status"] = "OK";
      let error: string | null = null;

      try {
        const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
        httpStatus = resp?.status() ?? null;
        await page.waitForLoadState("networkidle");

        const html = await page.content();
        const title = await page.title();

        // Check for challenge
        if (looksLikeChallenge(html, title)) {
          status = "CHALLENGE";
          pages.push({
            runId,
            pageNumber: p,
            url,
            status,
            httpStatus,
            itemsSeen: 0,
            itemsParsed: 0,
            error: "challenge_detected",
          });
          logger.warn("challenge", `page=${p} url=${url}`);
          break;
        }

        // DOM extraction - product cards with "грн"
        const items = await page.evaluate(() => {
          const out: { href: string | null; text: string }[] = [];
          const anchors = Array.from(
            document.querySelectorAll('a[href^="/product/"]')
          );

          for (const a of anchors) {
            const text = (a as HTMLElement).innerText?.trim?.() ?? "";
            if (!text || !text.toLowerCase().includes("грн")) continue;
            out.push({
              href: (a as HTMLAnchorElement).getAttribute("href"),
              text,
            });
          }

          return out.slice(0, 5000);
        });

        const seen = new Set<string>();
        for (const it of items) {
          const key = `${it.href ?? ""}::${it.text.slice(0, 80)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const extracted = extractPriceAndTitle(it.text);
          if (!extracted) continue;

          const { title: productTitle, price } = extracted;

          products.push({
            runId,
            scrapedAt: new Date().toISOString(),
            pageUrl: url,
            pageNumber: p,
            source: "https://silpo.ua",
            productUrl: it.href ? `https://silpo.ua${it.href}` : null,
            productId: null,
            title: productTitle,
            brand: null,
            priceCurrent: price,
            priceOld: null,
            discountPct: null,
            rawJson: null,
          });
          parsed++;
        }

        // API fallback if DOM empty
        if (parsed === 0) {
          status = "EMPTY";
          try {
            const apiItems = await fetchProductsViaApi(234, p, config.perPage);
            if (apiItems.length > 0) {
              for (const api of apiItems) {
                const apiTitle = (
                  api.title ||
                  api.name ||
                  api.productName ||
                  ""
                )
                  .toString()
                  .trim();
                const apiPrice = Number(
                  api.currentPrice ?? api.priceCurrent ?? api.salePrice ?? api.price
                );

                if (
                  !apiTitle ||
                  !Number.isFinite(apiPrice) ||
                  apiPrice <= 0
                )
                  continue;

                const u = api.url || api.productUrl || api.link;
                const productUrl =
                  typeof u === "string" && u.startsWith("/")
                    ? `https://silpo.ua${u}`
                    : typeof u === "string"
                      ? u
                      : null;

                products.push({
                  runId,
                  scrapedAt: new Date().toISOString(),
                  pageUrl: url,
                  pageNumber: p,
                  source: "https://silpo.ua",
                  productUrl,
                  productId: api.id ? String(api.id) : null,
                  title: apiTitle,
                  brand: api.brand?.name ?? api.brand?.title ?? null,
                  priceCurrent: apiPrice,
                  priceOld: api.oldPrice ? Number(api.oldPrice) : null,
                  discountPct: api.discount ? Number(api.discount) : null,
                  rawJson: JSON.stringify(api),
                });
              }
              parsed = apiItems.length;
              status = "API";
            }
          } catch {
            // Ignore API fallback errors
          }
        }
      } catch (e: any) {
        status = "ERROR";
        error = String(e?.message ?? e).slice(0, 300);
        logger.error("page_error", `page=${p} url=${url} err=${error}`);
      }

      pages.push({
        runId,
        pageNumber: p,
        url,
        status,
        httpStatus,
        itemsSeen: 0,
        itemsParsed: parsed,
        error,
      });
      logger.info("page_done", `page=${p} status=${status} parsed=${parsed}`);
    }
  } finally {
    await browser.close();
  }

  return { products, pages };
}
