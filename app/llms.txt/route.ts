import { SERVICES, priceFor } from "@/lib/services-catalog";

// /llms.txt — the plain-text service sheet an LLM or agent reads first.
// Mirrors CryptoIntel's /llms.txt format; the service list comes from
// lib/services-catalog.ts so it can never drift from the agent card.
const ORIGIN = "https://x402-web-reader.vercel.app";

export async function GET() {
  const lines: string[] = [
    "# WebReader",
    "",
    "> Pay-per-call web page reader for AI agents. Send a URL, get clean AI-readable Markdown back.",
    "",
    "Pay-per-call services for AI agents, paid in USDC on Base via the x402",
    "protocol. No API key, no account, no subscription. To call a service:",
    "POST to its endpoint without payment, read the HTTP 402 challenge in",
    "the PAYMENT-REQUIRED header, pay the stated amount in USDC on Base",
    "(network eip155:8453), then retry the same POST with the payment",
    "payload. Payment settles only on a 2xx success — failed calls (502)",
    "are never charged.",
    "",
    "## Services",
    "",
  ];
  for (const svc of SERVICES) {
    lines.push(
      `### ${svc.name} — ${priceFor(svc)} per call`,
      "",
      svc.description,
      "",
      `POST ${ORIGIN}/api/${svc.slug}`,
      `Input (JSON): ${JSON.stringify(svc.inputExample)}`,
      `Required fields: ${svc.inputRequired.join(", ")}`,
      "",
    );
  }
  lines.push(
    "## Discovery",
    "",
    `- OpenAPI: ${ORIGIN}/openapi.json`,
    `- x402 resource list: ${ORIGIN}/.well-known/x402`,
    `- A2A agent card: ${ORIGIN}/.well-known/agent-card.json`,
    `- This file: ${ORIGIN}/llms.txt`,
    "",
    "Note: this deployment speaks x402 over plain HTTP/JSON. It does not",
    "run an MCP transport, so there is deliberately no MCP server card —",
    "call the REST endpoints above (they are the same tools an MCP server",
    "would wrap).",
    "",
  );
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
