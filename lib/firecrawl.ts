import type { ExtractedPage } from "./extract";

// ---------------------------------------------------------------------------
// Firecrawl fallback (https://api.firecrawl.dev/v2/scrape)
//
// Used only when FIRECRAWL_API_KEY is set AND the local extractor either
// fails outright or returns a near-empty page (e.g. a JavaScript shell).
// Firecrawl renders pages in a real browser, so it rescues reads the local
// fetch + Readability pipeline cannot — and a rescued read is a settled
// payment instead of a 502. Each scrape costs Firecrawl credits, which is
// why it is the fallback and not the primary engine.
// ---------------------------------------------------------------------------

const FIRECRAWL_TIMEOUT_MS = 30_000;

export function firecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

/** Scrape an already-validated public URL via Firecrawl; returns Markdown. */
export async function extractWithFirecrawl(
  url: URL,
): Promise<ExtractedPage> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Firecrawl fallback is not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url: url.toString(), formats: ["markdown"] }),
    });
    if (!res.ok) {
      throw new Error(`Firecrawl returned HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        markdown?: string;
        metadata?: Record<string, unknown>;
      };
    };
    const markdown = json.data?.markdown?.trim();
    if (!json.success || !markdown) {
      throw new Error("Firecrawl returned no content for this page");
    }
    const meta = json.data?.metadata ?? {};
    const str = (v: unknown): string | null =>
      typeof v === "string" && v ? v : null;
    return {
      url: str(meta.sourceURL) ?? url.toString(),
      title: str(meta.title) ?? "",
      excerpt: str(meta.description) ?? str(meta.ogDescription) ?? null,
      markdown,
      wordCount: markdown.split(/\s+/).filter(Boolean).length,
    };
  } finally {
    clearTimeout(timer);
  }
}
