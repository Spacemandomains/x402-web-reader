import { searchWithTavily } from "./tavily";
import { llmConfigured, synthesizeBriefing } from "./synthesize";

// ---------------------------------------------------------------------------
// Research pipeline: question in → sourced briefing out.
//
//   1. Tavily advanced search gathers and extracts the top sources.
//   2. If an LLM key is configured, the briefing is synthesized from the
//      full source text with inline citations. Otherwise the briefing is
//      Tavily's own generated answer followed by the top source extracts —
//      still a finished, sourced answer, just less polished.
//
// Any failure throws; the route turns that into a 502 so the caller's
// payment never settles for a failed research run.
// ---------------------------------------------------------------------------

export interface ResearchResult {
  question: string;
  briefing: string;
  sources: Array<{ title: string; url: string }>;
  sourceCount: number;
  wordCount: number;
}

export async function runResearch(question: string): Promise<ResearchResult> {
  const useLlm = llmConfigured();
  const search = await searchWithTavily(question, { wantAnswer: !useLlm });

  let body: string;
  if (useLlm) {
    body = await synthesizeBriefing(question, search.results);
  } else if (search.answer) {
    const extracts = search.results
      .slice(0, 3)
      .map((r, i) => {
        const text = (r.content || r.rawContent || "").slice(0, 1200);
        return `### ${i + 1}. ${r.title}\n${text}`;
      })
      .join("\n\n");
    body = `${search.answer}\n\n## Top source extracts\n\n${extracts}`;
  } else {
    throw new Error(
      "Research synthesis is unavailable (no answer engine configured)",
    );
  }

  const sourceList = search.results
    .map((r, i) => `${i + 1}. [${r.title}](${r.url})`)
    .join("\n");
  const briefing = `${body}\n\n## Sources\n\n${sourceList}`;

  return {
    question,
    briefing,
    sources: search.results.map((r) => ({ title: r.title, url: r.url })),
    sourceCount: search.results.length,
    wordCount: briefing.split(/\s+/).filter(Boolean).length,
  };
}
