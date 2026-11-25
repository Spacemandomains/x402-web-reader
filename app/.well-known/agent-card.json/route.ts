import { NextResponse } from "next/server";
import { SERVICES, priceFor } from "@/lib/services-catalog";

// A2A agent card (/.well-known/agent-card.json) — how A2A-aware agents
// discover what this agent can do before calling it. Mirrors
// CryptoIntel's agent card; generated from lib/services-catalog.ts.
const ORIGIN = "https://x402-web-reader.vercel.app";

export async function GET() {
  return NextResponse.json({
    name: "WebReader",
    description:
      "Pay-per-call web page reader for AI agents. Send a URL, get clean AI-readable Markdown back.",
    url: `${ORIGIN}/`,
    provider: { organization: "WebReader", url: `${ORIGIN}/` },
    version: "1.1.0",
    documentationUrl: `${ORIGIN}/llms.txt`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    // Payment is x402, not an account/API key: an unpaid call returns a
    // 402 challenge; the caller pays in USDC on Base and retries.
    securitySchemes: {
      x402: {
        type: "apiKey",
        in: "header",
        name: "PAYMENT-SIGNATURE",
        description:
          "x402 v2 payment payload (USDC on Base, network eip155:8453). Call unpaid first to receive the 402 challenge in the PAYMENT-REQUIRED header.",
      },
    },
    security: [{ x402: [] }],
    skills: SERVICES.map((svc) => ({
      id: svc.slug,
      name: svc.name,
      description: `${svc.description} Price: ${priceFor(svc)} per call, paid in USDC on Base via x402. Endpoint: POST ${ORIGIN}/api/${svc.slug}`,
      tags: svc.tags,
      inputModes: ["application/json"],
      outputModes: ["application/json"],
      examples: [JSON.stringify(svc.inputExample)],
    })),
  });
}
