// ============================================================================
// SERVICES CATALOG — WebReader's paid services, for discovery files only.
//
// The /llms.txt sheet and the /.well-known/agent-card.json A2A card are
// generated from this list (mirroring CryptoIntel's lib/agent-config.ts
// pattern) so the discovery files can never drift from each other. The
// paid routes themselves (app/api/*/route.ts) keep their own x402 config;
// prices here mirror those routes' env vars and defaults.
// ============================================================================

export interface CatalogService {
  slug: string;
  name: string;
  description: string;
  priceEnv: string;
  defaultPrice: string;
  inputExample: Record<string, unknown>;
  inputRequired: string[];
  tags: string[];
}

/**
 * Read-Lite's x402 resource description — the exact string carried in its
 * 402 challenge (app/api/read-lite/route.ts imports this too).
 * Front-loads the phrases agents search for ("read a web page",
 * "web reader", "fetch URL", "extract text", "scrape page to clean
 * Markdown"). 234 characters: inside the 205–269 proven-good zone and
 * under the ~270-char CDP limit (see the Nov 24 Token Verdict lesson —
 * longer descriptions break CDP payment verification).
 */
export const READ_LITE_DESCRIPTION =
  "Read a web page — web reader for AI agents: fetch any URL, extract text and scrape a page to clean Markdown, URL-to-Markdown for articles and docs. Low-cost lite tier for high-volume agent loops. Pay per call — no API key, no account.";

/**
 * Deal Verdict's x402 resource description — the exact string carried in
 * its 402 challenge (app/api/deal-verdict/route.ts imports this too).
 * Front-loads the phrases shopping agents search for ("deal check",
 * "shopping agents", "Black Friday price", "real deal", "fake discount").
 * 244 characters: inside the 205–269 proven-good zone and under the
 * ~270-char CDP limit.
 */
export const DEAL_VERDICT_DESCRIPTION =
  "Deal check for shopping agents — is this Black Friday price a real deal or a fake discount? Send a product and the price you found; get a verdict (real_deal / fake_discount / overpriced), the lowest price found, and cited sources. Pay per call.";

export const SERVICES: CatalogService[] = [
  {
    slug: "read-lite",
    name: "WebReader Lite — Read a Web Page",
    description: READ_LITE_DESCRIPTION,
    priceEnv: "READ_LITE_PRICE",
    defaultPrice: "$0.005",
    inputExample: { url: "https://example.com" },
    inputRequired: ["url"],
    tags: ["x402", "web-reader", "read-web-page", "fetch-url", "web-scraping", "markdown", "paid-api"],
  },
  {
    slug: "deal-verdict",
    name: "Deal Verdict — Deal Check for Shopping Agents",
    description: DEAL_VERDICT_DESCRIPTION,
    priceEnv: "DEAL_VERDICT_PRICE",
    defaultPrice: "$0.01",
    inputExample: { product: "Apple AirPods Pro 2", price: 189 },
    inputRequired: ["product", "price"],
    tags: ["x402", "deal-check", "price-check", "shopping-agent", "black-friday", "cyber-monday", "fake-discount", "price-comparison", "paid-api"],
  },
  {
    slug: "read",
    name: "WebReader — Read a Web Page",
    description:
      "Fetch any web page and return its main content as clean, AI-readable Markdown. Pay per call — no API key, no account.",
    priceEnv: "PRICE",
    defaultPrice: "$0.02",
    inputExample: { url: "https://example.com" },
    inputRequired: ["url"],
    tags: ["x402", "web-reader", "read-web-page", "fetch-url", "web-scraping", "markdown", "paid-api"],
  },
  {
    slug: "research",
    name: "WebReader Research — Sourced Research Briefing",
    description:
      "Ask a research question and get a finished, sourced briefing in Markdown — multiple web sources searched, read, and synthesized with citations. Pay per call — no API key, no account.",
    priceEnv: "RESEARCH_PRICE",
    defaultPrice: "$0.50",
    inputExample: {
      question:
        "What is the x402 protocol, and how do AI agents use it to pay for services?",
    },
    inputRequired: ["question"],
    tags: ["x402", "web-research", "research-briefing", "web-search", "paid-api"],
  },
];

export function priceFor(svc: CatalogService): string {
  return process.env[svc.priceEnv] ?? svc.defaultPrice;
}
