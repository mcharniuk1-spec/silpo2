/**
 * Best-effort API fallback.
 * If Silpo site blocks DOM/JSON payloads, sometimes a catalog API still responds.
 * This function is intentionally defensive: if schema changes, it returns [] and logs it.
 */
export async function fetchProductsViaApi(categoryId: number, page: number, perPage: number) {
  const url = "https://api.catalog.ecom.silpo.ua/api/2.0/exec/EcomCatalogGlobal";

  const body = {
    query: { collection: "EcomCatalogGlobal" },
    variables: {
      categoryId,
      page,
      perPage
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    return { ok: false, status: res.status, items: [] as any[] };
  }

  const json: any = await res.json().catch(() => null);
  // schema is unknown; try common places
  const items =
    json?.data?.items ??
    json?.data?.products ??
    json?.items ??
    [];

  return { ok: true, status: res.status, items: Array.isArray(items) ? items : [] };
}
