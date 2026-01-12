/**
 * Fallback catalog API for Silpo
 * No guarantees about schema stability - use for discovery
 */

export async function fetchProductsViaApi(
  categoryId: number,
  page: number,
  perPage: number
) {
  const body = {
    query: { collection: "EcomCatalogGlobal" },
    filter: { category: [categoryId] },
    page: { number: page, size: perPage },
  };

  try {
    const resp = await fetch(
      "https://api.catalog.ecom.silpo.ua/api/2.0/exec/EcomCatalogGlobal",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) return [];

    const data: any = await resp.json();
    const items = data?.data?.items;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}
