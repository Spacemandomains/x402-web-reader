import { NextResponse } from "next/server";

// Machine-readable service description for x402 directories (x402scan
// reads /openapi.json first). Prices mirror the live routes' env config.
const ORIGIN = "https://x402-web-reader.vercel.app";

function usd(priceEnv: string | undefined, fallback: string): string {
  return (priceEnv ?? fallback).replace(/^\$/, "");
}

const readPrice = usd(process.env.PRICE, "$0.10");
const readLitePrice = usd(process.env.READ_LITE_PRICE, "$0.005");
const dealVerdictPrice = usd(process.env.DEAL_VERDICT_PRICE, "$0.01");
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
        "Pay-per-call web reading, deal checks, and research for AI agents. POST a URL and get the page back as clean Markdown ($0.10, or $0.005 via the lite tier for high-volume loops), POST a product and the price you found and get a deal verdict ($0.01), or POST a question and get a finished, sourced research briefing ($1.00). Paid in USDC on Base via the x402 protocol — no API key, no account.",
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
      "/api/read-lite": {
        post: {
          operationId: "readPageLite",
          summary: "Fetch a web page as clean Markdown (lite, low-cost tier)",
          description:
            "Fetch any web page and return its main content as clean, AI-readable Markdown — the low-cost lite tier for high-volume agent loops. Same extraction as /api/read; Markdown only, no research synthesis. Pay per call — no API key, no account.",
          security: [{ x402: [] }],
          "x-payment-info": paymentInfo(readLitePrice),
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
      "/api/deal-verdict": {
        post: {
          operationId: "dealVerdict",
          summary: "Check whether a price is a real deal or a fake discount",
          description:
            "Deal check for shopping agents: send a product and the price you found; get a deterministic verdict (real_deal / fake_discount / overpriced / fair), the lowest price found, and cited sources. Prices are extracted from live web sources — never invented. Pay per call — no API key, no account.",
          security: [{ x402: [] }],
          "x-payment-info": paymentInfo(dealVerdictPrice),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
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
                      description:
                        "Optional: the product page URL where the price was found.",
                    },
                    compareAtPrice: {
                      type: "number",
                      description:
                        "Optional: the claimed original ('was') price, used to detect fake discounts.",
                    },
                  },
                  required: ["product", "price"],
                },
                example: { product: "Apple AirPods Pro 2", price: 189 },
              },
            },
          },
          responses: {
            "200": {
              description:
                "The verdict, lowest and typical prices found, and every source price cited with its URL.",
            },
            "400": {
              description: "Missing or invalid product / price. Never charged.",
            },
            "402": paymentRequiredResponse,
            "502": {
              description:
                "Not enough price data could be extracted to judge the deal. Failed calls are never charged.",
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
