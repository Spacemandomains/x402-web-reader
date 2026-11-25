import type { TavilyResult } from "./tavily";

// ---------------------------------------------------------------------------
// Briefing synthesis
//
// Turns Tavily search results into a sourced Markdown briefing. Uses the
// first configured LLM provider:
//   OPENAI_API_KEY    → OpenAI chat completions (model: LLM_MODEL or
//                       gpt-4o-mini)
//   ANTHROPIC_API_KEY → Anthropic messages (model: LLM_MODEL or
//                       claude-3-5-haiku-latest)
// With neither key set, the research pipeline falls back to Tavily's own
// generated answer plus source extracts (see lib/research.ts).
// ---------------------------------------------------------------------------

const LLM_TIMEOUT_MS = 90_000;
// Keep the source pack bounded so per-call model cost stays a small
// fraction of the $0.50 price.
const MAX_SOURCE_CHARS = 48_000;
const MAX_PER_SOURCE_CHARS = 9_000;

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

function sourcePack(results: TavilyResult[]): string {
  let used = 0;
  const parts: string[] = [];
  results.forEach((r, i) => {
    if (used >= MAX_SOURCE_CHARS) return;
    const text = (r.rawContent ?? r.content).slice(0, MAX_PER_SOURCE_CHARS);
    const chunk = `[${i + 1}] ${r.title}\nURL: ${r.url}\n${text}`;
    parts.push(chunk);
    used += chunk.length;
  });
  return parts.join("\n\n---\n\n");
}

const SYSTEM_PROMPT = `You are a research analyst writing briefings for an AI agent that paid for a finished answer. Rules:
- Answer the question directly and completely, leading with the conclusion.
- Use ONLY facts from the numbered sources provided. Never invent facts, prices, dates, or names.
- Cite sources inline as [1], [2], etc. matching the source numbers.
- Write in clean Markdown: a short opening answer, then the supporting detail with headings or bullets where they help.
- If the sources disagree, say so and give both sides with their citations.
- If the sources do not answer the question, say plainly what they do and do not cover.
- Do not add a source list at the end; the caller appends it.`;

async function callOpenAi(
  question: string,
  pack: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Question: ${question}\n\nSources:\n\n${pack}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned an empty briefing");
  return text;
}

async function callAnthropic(
  question: string,
  pack: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL ?? "claude-3-5-haiku-latest",
      max_tokens: 2048,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nSources:\n\n${pack}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
  if (!text) throw new Error("Anthropic returned an empty briefing");
  return text;
}

/** Write the briefing body (without the source list) from search results. */
export async function synthesizeBriefing(
  question: string,
  results: TavilyResult[],
): Promise<string> {
  const pack = sourcePack(results);
  if (process.env.OPENAI_API_KEY) return callOpenAi(question, pack);
  if (process.env.ANTHROPIC_API_KEY) return callAnthropic(question, pack);
  throw new Error("No LLM provider is configured");
}
