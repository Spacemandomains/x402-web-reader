import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { extractPage } from "@/lib/extract";

// ---------------------------------------------------------------------------
// Configuration (environment variables — see .env.example)
//   PAY_TO_ADDRESS   Coinbase Wallet address (Base) that receives payments.
//                    Leave unset for free local testing (no paywall).
//   X402_NETWORK     "eip155:8453" = Base mainnet (live money)
//                    "eip155:84532" = Base Sepolia testnet (default, fake money)
//   FACILITATOR_URL  x402 facilitator that verifies/settles payments.
//   PRICE            Price per read, e.g. "$0.005" (default)
// ---------------------------------------------------------------------------
const payTo = process.env.PAY_TO_ADDRESS as `0x${string}` | undefined;
const network = (process.env.X402_NETWORK ?? "eip155:84532") as Network;
const facilitatorUrl =
  process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const price = process.env.PRICE ?? "$0.005";

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
export const POST = payTo
  ? withX402(
      handler,
      {
        "/api/read": {
          accepts: {
            scheme: "exact",
            payTo,
            price,
            network,
          },
          description:
            "Fetch any web page and return its main content as clean, AI-readable Markdown. Pay per call — no API key, no account.",
          mimeType: "application/json",
        },
      },
      new x402ResourceServer(
        new HTTPFacilitatorClient({ url: facilitatorUrl }),
      ).register(network, new ExactEvmScheme()),
    )
  : handler;
