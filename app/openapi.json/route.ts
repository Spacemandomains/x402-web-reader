import { NextResponse } from "next/server";

// Machine-readable service description for x402 directories (x402scan
// reads /openapi.json first). Prices mirror the live routes' env config.
const ORIGIN = "https://x402-web-reader.vercel.app";

function usd(priceEnv: string | undefined, fallback: string): string {
  return (priceEnv ?? fallback).replace(/^\$/, "");
}

const readPrice = usd(process.env.PRICE, "$0.10");
const researchPrice = usd(process.env.RESEARCH_PRICE, "$1.00");

const paymentInfo = (amount: string) => ({
  protocols: ["x402"],
  price: { mode: "fixed", currency: "USD", amount },
});

const paymentRequiredResponse = {
  description:
    "Payment required. The response carries an x402 v2 payment challenge in the Payment-Required header: pay in USDC on Base (eip155:8453) and retry the POST with the payment payload. No API key or account is needed.",
};

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "WebReader",
      version: "1.0.0",
      description:
        "Pay-per-call web reading and research for AI agents. POST a URL and get the page back as clean Markdown ($0.10), or POST a question and get a finished, sourced research briefing ($1.00). Paid in USDC on Base via the x402 protocol — no API key, no account.",
      contact: { name: "WebReader", url: `${ORIGIN}/` },
    },
    servers: [{ url: ORIGIN }],
    paths: {
      "/api/read": {
        post: {
          operationId: "readPage",
          summary: "Fetch a web page as clean Markdown",
          description:
            "Fetch any web page and return its main content as clean, AI-readable Markdown. Pay per call — no API key, no account.",
          security: [{ x402: [] }],
          "x-payment-info": paymentInfo(readPrice),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: {
                      type: "string",
                      description:
                        "The web page URL to fetch and convert to Markdown.",
                    },
                  },
                  required: ["url"],
                },
                example: { url: "https://example.com" },
              },
            },
          },
          responses: {
            "200": {
              description:
                "The page content as Markdown, with title, excerpt, and word count.",
            },
            "402": paymentRequiredResponse,
            "502": {
              description:
                "The page could not be read. Failed calls are never charged.",
            },
          },
        },
      },
      "/api/research": {
        post: {
          operationId: "researchQuestion",
          summary: "Get a sourced research briefing",
          description:
            "Ask a research question and get a finished, sourced briefing in Markdown — multiple web sources searched, read, and synthesized with citations. Pay per call — no API key, no account.",
          security: [{ x402: [] }],
          "x-payment-info": paymentInfo(researchPrice),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    question: {
                      type: "string",
                      description:
                        "The research question to answer with a sourced briefing (500 characters max).",
                    },
                  },
                  required: ["question"],
                },
                example: {
                  question:
                    "What is the x402 protocol, and how do AI agents use it to pay for services?",
                },
              },
            },
          },
          responses: {
            "200": {
              description:
                "A sourced briefing in Markdown, with the source list and word count.",
            },
            "402": paymentRequiredResponse,
            "502": {
              description:
                "The research could not be completed. Failed calls are never charged.",
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        x402: {
          type: "apiKey",
          in: "header",
          name: "PAYMENT-SIGNATURE",
          description:
            "x402 v2 payment payload. Call unpaid first to receive the 402 challenge in the Payment-Required response header, sign the USDC payment on Base, then retry with this header.",
        },
      },
    },
  });
}
