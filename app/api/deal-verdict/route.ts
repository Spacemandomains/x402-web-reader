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
import { runDealCheck } from "@/lib/deal-verdict";
import { DEAL_VERDICT_DESCRIPTION } from "@/lib/services-catalog";

// Price searches (two Tavily calls) take longer than a page read.
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Deal Verdict — the Black Friday / Cyber Monday deal check for shopping
// agents, sold alongside WebReader Lite. Configuration mirrors
// app/api/read-lite/route.ts (same wallet, network, and facilitator
// selection), with its own price:
//   DEAL_VERDICT_PRICE  Price per deal check (default "$0.01")
//   TAVILY_API_KEY      Required — the price-search engine.
//
// Input:  { product, price, url?, compareAtPrice? } — a product name (or
//         a product page URL as `product`), plus the price the calling
//         shopping agent found.
// Output: a deterministic verdict (real_deal / fake_discount /
//         overpriced / fair) computed ONLY from prices extracted from
//         cited web sources — never an invented price. When too little
//         price data can be extracted, the call fails with 502 and the
//         payment never settles.
// ---------------------------------------------------------------------------
const payTo = process.env.PAY_TO_ADDRESS as `0x${string}` | undefined;
const network = (process.env.X402_NETWORK ?? "eip155:84532") as Network;
const facilitatorUrl =
  process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const price = process.env.DEAL_VERDICT_PRICE ?? "$0.01";

const useCdp = Boolean(
  process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET,
);
const facilitatorClient = useCdp
  ? new HTTPFacilitatorClient(createFacilitatorConfig())
  : new HTTPFacilitatorClient({ url: facilitatorUrl });

const isPrice = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

async function handler(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as {
    product?: unknown;
    price?: unknown;
    url?: unknown;
    compareAtPrice?: unknown;
  };
  // `product` carries the product name (or a product page URL); fall back
  // to `url` as the product identifier when product itself is absent.
  const productRaw =
    typeof b.product === "string" && b.product.trim()
      ? b.product.trim()
      : typeof b.url === "string" && b.url.trim()
        ? b.url.trim()
        : null;
  if (!productRaw) {
    return NextResponse.json(
      { error: "Missing required field: product (a product name or URL)" },
      { status: 400 },
    );
  }
  if (productRaw.length > 300) {
    return NextResponse.json(
      { error: "Product is too long (300 characters max)" },
      { status: 400 },
    );
  }
  if (!isPrice(b.price)) {
    return NextResponse.json(
      { error: "Missing or invalid field: price (the price you found, a number > 0)" },
      { status: 400 },
    );
  }
  const url =
    typeof b.url === "string" && b.url.trim() ? b.url.trim() : null;
  let compareAtPrice: number | null = null;
  if (b.compareAtPrice !== undefined && b.compareAtPrice !== null) {
    if (!isPrice(b.compareAtPrice)) {
      return NextResponse.json(
        { error: "Invalid field: compareAtPrice (a number > 0)" },
        { status: 400 },
      );
    }
    compareAtPrice = b.compareAtPrice;
  }

  try {
    const result = await runDealCheck({
      product: productRaw,
      url,
      price: b.price,
      compareAtPrice,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deal check failed";
    // 502 (not <400) so withX402 does NOT settle payment when there is
    // not enough price data to judge the deal.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Paywalled exactly like /api/read-lite: unpaid calls get HTTP 402;
// payment settles only when a verdict is produced. The Bazaar discovery
// extension is declared so catalogs can index this service too.
const routes = {
  "/api/deal-verdict": {
    accepts: {
      scheme: "exact" as const,
      payTo: payTo as `0x${string}`,
      price,
      network,
    },
    description: DEAL_VERDICT_DESCRIPTION,
    mimeType: "application/json",
    extensions: declareDiscoveryExtension({
      input: { product: "Apple AirPods Pro 2", price: 189 },
      inputSchema: {
        properties: {
          product: {
            type: "string",
            description:
              "The product name (or a product page URL) whose price should be checked.",
          },
          price: {
            type: "number",
            description: "The price the calling agent found, in USD.",
          },
          url: {
            type: "string",
            description: "Optional: the product page URL where the price was found.",
          },
          compareAtPrice: {
            type: "number",
            description:
              "Optional: the claimed original ('was') price, used to detect fake discounts.",
          },
        },
        required: ["product", "price"],
      },
      bodyType: "json",
      output: {
        example: {
          product: "Apple AirPods Pro 2",
          url: null,
          verdict: "real_deal",
          inputPrice: 189,
          compareAtPrice: null,
          lowestFound: {
            price: 189,
            sourceUrl: "https://www.walmart.com/ip/example",
            store: "walmart.com",
          },
          typicalPrice: 229,
          savingsVsTypical: 40,
          sources: [
            {
              price: 189,
              url: "https://www.walmart.com/ip/example",
              title: "Apple AirPods Pro (2nd Generation)",
              store: "walmart.com",
            },
          ],
          sourceCount: 1,
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

// Directory probers often probe with GET or HEAD instead of POST. An
// unpaid GET returns the same 402 payment challenge; a paid GET reaches
// this hint and is NOT charged (405 does not settle).
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

// CORS preflight for browser-based agents (mirrors read-lite): never
// paywalled, and the global headers in next.config.ts expose
// PAYMENT-REQUIRED / PAYMENT-RESPONSE on the actual responses.
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, PAYMENT-SIGNATURE, X-PAYMENT",
      "Access-Control-Expose-Headers":
        "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
    },
  });
}
