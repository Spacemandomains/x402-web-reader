import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

export interface ExtractedPage {
  url: string;
  title: string;
  excerpt: string | null;
  markdown: string;
  wordCount: number;
}

const MAX_BYTES = 5_000_000; // 5 MB page cap
const FETCH_TIMEOUT_MS = 15_000;

/** Reject URLs that could reach private/internal addresses. */
function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    throw new Error("Private or local addresses are not allowed");
  }
  return url;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
// Drop elements that never carry article content.
turndown.remove(["script", "style", "noscript", "iframe", "form", "nav"]);

/**
 * Fetch a web page and return its main content as clean Markdown
 * that an AI agent can read.
 */
export async function extractPage(rawUrl: string): Promise<ExtractedPage> {
  const url = assertPublicUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  let finalUrl = url.toString();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 WebReader/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`Upstream page returned HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    }
    const text = await res.text();
    if (text.length > MAX_BYTES) {
      throw new Error("Page is too large to process");
    }
    html = text;
    finalUrl = res.url || finalUrl;
  } finally {
    clearTimeout(timer);
  }

  const dom = new JSDOM(html, { url: finalUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article && article.content) {
    const markdown = turndown.turndown(article.content).trim();
    const words = markdown.split(/\s+/).filter(Boolean).length;
    return {
      url: finalUrl,
      title: article.title || dom.window.document.title || "",
      excerpt: article.excerpt ?? null,
      markdown,
      wordCount: words,
    };
  }

  // Fallback: no article structure found — return the page's visible text.
  const fallbackText = (dom.window.document.body?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!fallbackText) {
    throw new Error("Could not extract readable content from this page");
  }
  return {
    url: finalUrl,
    title: dom.window.document.title || "",
    excerpt: null,
    markdown: fallbackText,
    wordCount: fallbackText.split(/\s+/).filter(Boolean).length,
  };
}
