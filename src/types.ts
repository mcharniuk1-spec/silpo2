export type RunStatus = "STARTED" | "OK" | "FAILED";

export type PageLog = {
  runId: string;
  pageNumber: number;
  url: string;
  status: "OK" | "EMPTY" | "BLOCKED" | "ERROR";
  httpStatus: number | null;
  itemsSeen: number;
  itemsParsed: number;
  error: string | null;
};

export type ProductRow = {
  runId: string;
  scrapedAt: string;

  pageUrl: string;
  pageNumber: number;

  source: string;
  productUrl: string;

  title: string;
  brand: string;
  productType: string;
  fatPct: string;

  packQty: number | null;
  packUnit: string;

  priceCurrent: number;
  priceOld: number | null;
  discountPct: string;

  pricePerUnit: number | null;
  rating: number | null;

  priceType: "discount" | "regular";
};
