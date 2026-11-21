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
import { extractPage } from "@/lib/extract";

// ---------------------------------------------------------------------------
// Configuration (environment variables — see .env.example)
//   PAY_TO_ADDRESS   Coinbase Wallet address (Base) that receives payments.
//                    Leave unset for free local testing (no paywall).
//   X402_NETWORK     "eip155:8453" = Base mainnet (live money)
//                    "eip155:84532" = Base Sepolia testnet (default, fake money)
//   FACILITATOR_URL  x402 facilitator that verifies/settles payments
//                    (used when no CDP keys are configured).
//   CDP_API_KEY_ID / CDP_API_KEY_SECRET
//                    When both are set, payments settle through Coinbase's
//                    CDP facilitator (required for Bazaar cataloging).
//   PRICE            Price per read, e.g. "$0.10" (default)
// ---------------------------------------------------------------------------
const payTo = process.env.PAY_TO_ADDRESS as `0x${string}` | undefined;
const network = (process.env.X402_NETWORK ?? "eip155:84532") as Network;
const facilitatorUrl =
  process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const price = process.env.PRICE ?? "$0.10";

// CDP keys present → settle through Coinbase CDP (signed JWT auth handled by
// @coinbase/x402). Otherwise fall back to the plain facilitator URL (e.g.
// PayAI's public mainnet facilitator, which needs no keys).
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

  const url = (body as { url?: unknown })?.url;
  if (typeof url !== "string" || !url) {
    return NextResponse.json(
      { error: "Missing required field: url" },
      { status: 400 },
    );
  }

  try {
    const page = await extractPage(url);
    return NextResponse.json(page);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    // 502 (not <400) so withX402 does NOT settle payment for failed reads.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// When a payout address is configured, the endpoint is paywalled with x402:
// an unpaid call gets HTTP 402 with payment instructions; after the agent
// pays in USDC, the request runs and payment settles only on success.
// The Bazaar discovery extension is declared so facilitators and catalogs
// (Coinbase Bazaar, Agentic Market) can index this service.
const routes = {
  "/api/read": {
    accepts: {
      scheme: "exact" as const,
      payTo: payTo as `0x${string}`,
      price,
      network,
    },
    description:
      "Fetch any web page and return its main content as clean, AI-readable Markdown. Pay per call — no API key, no account.",
    mimeType: "application/json",
    extensions: declareDiscoveryExtension({
      input: { url: "https://example.com" },
      inputSchema: {
        properties: {
          url: {
            type: "string",
            description:
              "The web page URL to fetch and convert to Markdown.",
          },
        },
        required: ["url"],
      },
      bodyType: "json",
      output: {
        example: {
          url: "https://example.com",
          title: "Example Domain",
          excerpt: "This domain is for use in documentation examples.",
          markdown:
            "# Example Domain\n\nThis domain is for use in documentation examples without needing permission.",
          wordCount: 12,
        },
      },
    }),
  },
};

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(network, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

export const POST = payTo
  ? withX402(handler, routes, resourceServer)
  : handler;

// Directory probers (x402scan, x402dash, PayAI) often probe with GET or
// HEAD instead of POST. An unpaid GET returns the same 402 payment
// challenge; a paid GET reaches this hint and is NOT charged (405 is not
// a success status, so withX402 does not settle).
async function getHint(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error:
        "Use POST. An unpaid POST returns the x402 payment challenge for this endpoint.",
    },
    { status: 405 },
  );
}

export const GET = payTo
  ? withX402(getHint, routes, resourceServer)
  : getHint;
