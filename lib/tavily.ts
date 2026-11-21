// ---------------------------------------------------------------------------
// Tavily search client (https://api.tavily.com/search)
//
// Tavily is a search API built for AI agents: one call runs the search AND
// extracts readable content from the results. The research endpoint uses it
// as its source-gathering step; an LLM (lib/synthesize.ts) then writes the
// briefing from these sources. Requires TAVILY_API_KEY.
// ---------------------------------------------------------------------------

const TAVILY_TIMEOUT_MS = 45_000;

export interface TavilyResult {
  title: string;
  url: string;
  /** Tavily's extracted text snippet for the page. */
  content: string;
  /** Full page content as Markdown, when raw content was returned. */
  rawContent: string | null;
  score: number | null;
}

export interface TavilySearch {
  answer: string | null;
  results: TavilyResult[];
}

export function tavilyConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

/**
 * Run one advanced Tavily search for `query`.
 * When `wantAnswer` is true, Tavily's own LLM answer is requested too —
 * the research pipeline uses that as its briefing when no LLM key of our
 * own is configured.
 */
export async function searchWithTavily(
  query: string,
  opts: { wantAnswer?: boolean } = {},
): Promise<TavilySearch> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Tavily is not configured");
  }

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
        max_results: 8,
        include_raw_content: "markdown",
        include_answer: opts.wantAnswer ? "advanced" : false,
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily returned HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      answer?: unknown;
      results?: Array<Record<string, unknown>>;
    };
    const str = (v: unknown): string | null =>
      typeof v === "string" && v ? v : null;
    const results: TavilyResult[] = (json.results ?? [])
      .map((r) => {
        const url = str(r.url);
        if (!url) return null;
        return {
          title: str(r.title) ?? url,
          url,
          content: str(r.content) ?? "",
          rawContent: str(r.raw_content),
          score: typeof r.score === "number" ? r.score : null,
        } satisfies TavilyResult;
      })
      .filter((r): r is TavilyResult => r !== null);
    if (results.length === 0) {
      throw new Error("Tavily found no results for this question");
    }
    return { answer: str(json.answer), results };
  } finally {
    clearTimeout(timer);
  }
}
