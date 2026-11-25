// ---------------------------------------------------------------------------
// Deal Verdict — deterministic price-check logic for shopping agents.
//
// Given a product and the price a shopping agent found, search the web
// (Tavily, advanced) for the product's current prices, extract $ prices
// from the results, and return a verdict computed ONLY from extracted
// prices. No price, store, or link is ever invented: every number in the
// output is extracted from a cited source below, and when too little
// price data can be extracted the caller gets an error (the route turns
// that into a 502, so the call is never charged).
//
// Extraction / aggregation rules (deterministic, in order):
//   1. Per search result, collect every $ price in title + snippet +
//      raw content. Discard prices < $1 (shipping/accessory noise) and
//      > $100,000 (not a consumer product price).
//   2. A result's price is its MOST FREQUENT extracted price — the main
//      product price repeats across a product page, while one-off
//      accessory / cross-sell prices do not. Ties break to the HIGHER
//      price (the main product is usually pricier than its accessories).
//   3. Across results, compute the median ("typical") price, then drop
//      outliers: anything < 0.4x or > 2.5x the median (wrong product,
//      accessory-only listing, bundle). Recompute typical + lowest from
//      the survivors. Fewer than 3 priced results (before or after
//      outlier filtering) = not enough data -> error.
//   4. Verdict, checked in this order:
//      - fake_discount: a compareAtPrice ("was" price) was provided AND
//        the input price is >= compareAtPrice (no discount at all) OR
//        >= the typical found price (the "sale" price is what other
//        stores charge normally).
//      - real_deal: input price <= lowest found * 1.02, or
//        <= typical * 0.90.
//      - overpriced: input price > typical * 1.10.
//      - fair: anything else.
// ---------------------------------------------------------------------------

const TAVILY_TIMEOUT_MS = 45_000;
const MIN_SOURCES = 3;

export type DealVerdict = "real_deal" | "fake_discount" | "overpriced" | "fair";

export interface PricedSource {
  price: number;
  url: string;
  title: string;
  store: string;
}

export interface DealCheckResult {
  product: string;
  url: string | null;
  verdict: DealVerdict;
  inputPrice: number;
  compareAtPrice: number | null;
  lowestFound: { price: number; sourceUrl: string; store: string };
  typicalPrice: number;
  savingsVsTypical: number;
  sources: PricedSource[];
  sourceCount: number;
}

interface RawResult {
  title: string;
  url: string;
  content: string;
  rawContent: string | null;
}

// --- price extraction (pure, exported for testing) ------------------------

const PRICE_RE = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/g;

export function extractPricesFromText(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(PRICE_RE)) {
    const v = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(v) && v >= 1 && v <= 100_000) out.push(v);
  }
  return out;
}

/** Most frequent value; ties break to the higher value. */
export function modalPrice(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const counts = new Map<number, number>();
  for (const p of prices) counts.set(p, (counts.get(p) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = -1;
  for (const [p, c] of counts) {
    if (c > bestCount || (c === bestCount && best !== null && p > best)) {
      best = p;
      bestCount = c;
    }
  }
  return best;
}

export function storeFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Reduce raw search results to one cited price per result. */
export function priceSources(results: RawResult[]): PricedSource[] {
  const out: PricedSource[] = [];
  for (const r of results) {
    const text = `${r.title}\n${r.content}\n${(r.rawContent ?? "").slice(0, 6000)}`;
    const price = modalPrice(extractPricesFromText(text));
    if (price !== null) {
      out.push({ price, url: r.url, title: r.title, store: storeFromUrl(r.url) });
    }
  }
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure verdict computation from cited source prices. Throws on too little data. */
export function computeVerdict(input: {
  product: string;
  url?: string | null;
  price: number;
  compareAtPrice?: number | null;
  sources: PricedSource[];
}): DealCheckResult {
  const { product, price, sources } = input;
  const compareAtPrice = input.compareAtPrice ?? null;
  if (sources.length < MIN_SOURCES) {
    throw new Error(
      `Not enough price data: only ${sources.length} priced source(s) found for this product`,
    );
  }
  const firstMedian = median(sources.map((s) => s.price));
  const survivors = sources.filter(
    (s) => s.price >= firstMedian * 0.4 && s.price <= firstMedian * 2.5,
  );
  if (survivors.length < MIN_SOURCES) {
    throw new Error(
      "Not enough consistent price data: extracted prices disagree too much to judge this deal",
    );
  }
  const typical = round2(median(survivors.map((s) => s.price)));
  const lowest = survivors.reduce((a, b) => (b.price < a.price ? b : a));

  let verdict: DealVerdict;
  if (
    compareAtPrice !== null &&
    (price >= compareAtPrice || price >= typical)
  ) {
    verdict = "fake_discount";
  } else if (price <= lowest.price * 1.02 || price <= typical * 0.9) {
    verdict = "real_deal";
  } else if (price > typical * 1.1) {
    verdict = "overpriced";
  } else {
    verdict = "fair";
  }

  return {
    product,
    url: input.url ?? null,
    verdict,
    inputPrice: price,
    compareAtPrice,
    lowestFound: {
      price: lowest.price,
      sourceUrl: lowest.url,
      store: lowest.store,
    },
    typicalPrice: typical,
    savingsVsTypical: round2(typical - price),
    sources: [...survivors].sort((a, b) => a.price - b.price),
    sourceCount: survivors.length,
  };
}

// --- Tavily price search ---------------------------------------------------

const RETAIL_DOMAINS = [
  "amazon.com", "walmart.com", "target.com", "bestbuy.com", "ebay.com",
  "newegg.com", "costco.com", "homedepot.com", "lowes.com", "wayfair.com",
  "bhphotovideo.com", "adorama.com", "backmarket.com", "macys.com",
  "kohls.com", "nike.com", "apple.com", "samsung.com",
];

async function tavilySearch(
  apiKey: string,
  query: string,
  includeDomains?: string[],
): Promise<RawResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        topic: "general",
        search_depth: "advanced",
        max_results: 10,
        include_raw_content: "markdown",
        include_answer: false,
        ...(includeDomains ? { include_domains: includeDomains } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Tavily returned HTTP ${res.status}`);
    const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const str = (v: unknown): string | null =>
      typeof v === "string" && v ? v : null;
    return (json.results ?? [])
      .map((r) => {
        const url = str(r.url);
        if (!url) return null;
        return {
          title: str(r.title) ?? url,
          url,
          content: str(r.content) ?? "",
          rawContent: str(r.raw_content),
        } satisfies RawResult;
      })
      .filter((r): r is RawResult => r !== null);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search Tavily for the product's current prices — one open web search
 * plus one restricted to major retail domains, merged and deduped by
 * URL — then compute the deterministic verdict.
 */
export async function runDealCheck(input: {
  product: string;
  url?: string | null;
  price: number;
  compareAtPrice?: number | null;
}): Promise<DealCheckResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Tavily is not configured");

  const query = `${input.product} price buy`;
  const [open, retail] = await Promise.allSettled([
    tavilySearch(apiKey, query),
    tavilySearch(apiKey, query, RETAIL_DOMAINS),
  ]);
  const merged = new Map<string, RawResult>();
  for (const settled of [open, retail]) {
    if (settled.status === "fulfilled") {
      for (const r of settled.value) if (!merged.has(r.url)) merged.set(r.url, r);
    }
  }
  if (merged.size === 0) {
    throw new Error("Price search returned no results for this product");
  }
  return computeVerdict({ ...input, sources: priceSources([...merged.values()]) });
}
