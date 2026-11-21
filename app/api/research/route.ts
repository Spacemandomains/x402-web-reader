import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";
import { createFacilitatorConfig } from "@coinbase/x402";
import { runResearch } from "@/lib/research";

// Research runs (search + synthesis) take longer than a page read.
export const maxDuration = 180;

// ---------------------------------------------------------------------------
// Configuration mirrors app/api/read/route.ts (same wallet, network, and
// facilitator selection), with its own price:
//   RESEARCH_PRICE   Price per research call (default "$1.00")
//   TAVILY_API_KEY   Required — the search/extraction engine.
//   OPENAI_API_KEY / ANTHROPIC_API_KEY
//                    Optional — when either is set, the briefing is
//                    synthesized by that LLM from the full source text;
//                    otherwise Tavily's own generated answer is used.
// ---------------------------------------------------------------------------
const payTo = process.env.PAY_TO_ADDRESS as `0x${string}` | undefined;
const network = (process.env.X402_NETWORK ?? "eip155:84532") as Network;
const facilitatorUrl =
  process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const price = process.env.RESEARCH_PRICE ?? "$1.00";

const useCdp = Boolean(
  process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET,
);
const facilitatorClient = useCdp
  ? new HTTPFacilitatorClient(createFacilitatorConfig())
  : new HTTPFacilitatorClient({ url: facilitatorUrl });

async function handler(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const question = (body as { question?: unknown })?.question;
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json(
      { error: "Missing required field: question" },
      { status: 400 },
    );
  }
  if (question.length > 500) {
    return NextResponse.json(
      { error: "Question is too long (500 characters max)" },
      { status: 400 },
    );
  }

  try {
    const result = await runResearch(question.trim());
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    // 502 (not <400) so withX402 does NOT settle payment for failed runs.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Paywalled exactly like /api/read: unpaid calls get HTTP 402; payment
// settles only when the briefing is produced. The Bazaar discovery
// extension is declared so catalogs can index this service too.
export const POST = payTo
  ? withX402(
      handler,
      {
        "/api/research": {
          accepts: {
            scheme: "exact",
            payTo,
            price,
            network,
          },
          description:
            "Ask a research question and get a finished, sourced briefing in Markdown — multiple web sources searched, read, and synthesized with citations. Pay per call — no API key, no account.",
          mimeType: "application/json",
          extensions: declareDiscoveryExtension({
            input: {
              question: "What are the current US federal EV tax credit rules?",
            },
            inputSchema: {
              properties: {
                question: {
                  type: "string",
                  description:
                    "The research question to answer with a sourced briefing (500 characters max).",
                },
              },
              required: ["question"],
            },
            bodyType: "json",
            output: {
              example: {
                question:
                  "What are the current US federal EV tax credit rules?",
                briefing:
                  "The federal clean vehicle credit offers up to $7,500… [1]\n\n## Sources\n\n1. [IRS — Credits for new clean vehicles](https://www.irs.gov/...)",
                sources: [
                  {
                    title: "IRS — Credits for new clean vehicles",
                    url: "https://www.irs.gov/...",
                  },
                ],
                sourceCount: 8,
                wordCount: 640,
              },
            },
          }),
        },
      },
      new x402ResourceServer(facilitatorClient)
        .register(network, new ExactEvmScheme())
        .registerExtension(bazaarResourceServerExtension),
    )
  : handler;
