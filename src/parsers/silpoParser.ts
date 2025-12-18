import { cleanSpaces, toNum } from "../utils/text.js";

const KNOWN_BRANDS = [
  "Яготинське","Ферма","Галичина","Селянське","ПростоНаше","Премія","Молокія","Lactel","Бурьонка",
  "Даніссімо","Активіа","Простоквашино","Чудо","Агуня","Растішка","Actimel","Danone","Muller",
  "Біло","Білоцерківське","Тульчинка","Злагода","President","Alpro","Valio","Elle&Vire"
];

export function inferProductType(title: string): string {
  const t = title.toLowerCase();
  const map: Array<[string, string[]]> = [
    ["молоко", ["молоко"]],
    ["вершки", ["вершки"]],
    ["сметана", ["сметана"]],
    ["йогурт", ["йогурт"]],
    ["кефір", ["кефір"]],
    ["ряжанка", ["ряжанка"]],
    ["масло", ["масло"]],
    ["маргарин", ["маргарин"]],
    ["сир", ["сир", "бринза", "моцар", "чед", "гауда"]],
    ["сирок", ["сирок"]],
    ["десерт", ["десерт"]],
    ["творог", ["творог", "кисломолочний"]],
    ["згущене", ["згущене"]],
    ["яйця", ["яйце", "яйця"]]
  ];
  for (const [type, keys] of map) {
    if (keys.some((k) => t.includes(k))) return type;
  }
  return "";
}

export function inferBrand(title: string): string {
  const q = title.match(/«([^»]{2,30})»/);
  if (q) return q[1];

  for (const b of KNOWN_BRANDS) {
    if (title.includes(b)) return b;
  }

  const first = title.match(/^([A-ZА-ЯІЇЄҐ][\wА-Яа-яІіЇїЄєҐґ\-ʼ' ]{1,25})/);
  if (!first) return "";

  const candidate = first[1].trim();
  const exclude = new Set([
    "Молоко","Вершки","Кефір","Сметана","Ряжанка","Йогурт","Масло","Маргарин","Яйця","Яйце","Сир","Сирок","Десерт","Творог"
  ]);
  if (exclude.has(candidate)) return "";
  return candidate.length > 2 ? candidate : "";
}

export function extractPack(title: string): { qty: number | null; unit: string } {
  const t = title.toLowerCase();
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(кг|г|л|мл|шт)\b/i);
  if (!m) return { qty: null, unit: "" };

  const rawQty = toNum(m[1]);
  const u = m[2];

  if (!Number.isFinite(rawQty) || rawQty <= 0) return { qty: null, unit: "" };

  if (u === "л") return { qty: Math.round(rawQty * 1000), unit: "мл" };
  if (u === "кг") return { qty: Math.round(rawQty * 1000), unit: "г" };
  if (u === "мл") return { qty: Math.round(rawQty), unit: "мл" };
  if (u === "г") return { qty: Math.round(rawQty), unit: "г" };
  if (u === "шт") return { qty: Math.round(rawQty), unit: "шт" };

  return { qty: null, unit: "" };
}

export function extractDiscount(text: string): string {
  const d = text.match(/-\s*([0-9]{1,2})\s*%/);
  return d ? d[1] : "";
}

export function extractFat(title: string, discountPct: string): string {
  const a = title.match(/жир\w*\s*([0-9]+(?:[.,][0-9]+)?)\s*%?/i);
  if (a) {
    const v = toNum(a[1]);
    if (v >= 0 && v <= 50) return String(a[1]).replace(",", ".");
  }

  const all = Array.from(title.matchAll(/([0-9]+(?:[.,][0-9]+)?)\s*%/g)).map((m) => m[1]);
  for (const cand of all) {
    const v = toNum(cand);
    if (v >= 0 && v <= 50 && String(Math.round(v)) !== discountPct) return String(cand).replace(",", ".");
  }
  return "";
}

export function extractPrices(text: string): { current: number | null; old: number | null } {
  const prices = Array.from(text.matchAll(/(\d{1,4}(?:[.,]\d{2})?)\s*грн/g)).map((m) => toNum(m[1]));
  if (prices.length === 0) return { current: null, old: null };

  const current = prices[0] ?? null;
  const old = prices.length >= 2 ? prices[1] : null;
  return { current, old };
}

export function computePricePerUnit(price: number, qty: number | null, unit: string): number | null {
  if (!qty || !unit) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  if (unit === "шт") {
    const per = price / qty;
    return Math.round(per * 100) / 100;
  }

  const base = qty / 1000;
  if (base <= 0) return null;

  const per = price / base;
  return Math.round(per * 100) / 100;
}

export function normalizeTitle(text: string): string {
  // Remove obvious price chunks; keep semantic title.
  return cleanSpaces(
    text
      .replace(/\d{1,4}(?:[.,]\d{2})?\s*грн/g, " ")
      .replace(/-\s*[0-9]{1,2}\s*%/g, " ")
  );
}
