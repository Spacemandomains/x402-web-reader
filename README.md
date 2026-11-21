# WebReader — pay-per-call page reading for AI agents

Send any URL, get the page's main content back as clean, AI-readable
Markdown. Agents pay **$0.10 per read** in USDC on Base via the
[x402 protocol](https://x402.org) — no API key, no account, no subscription.

Built for listing on [Agentic Market](https://agentic.market) and the
Coinbase x402 Bazaar.

## How it works

- `POST /api/read` with `{ "url": "https://…" }`
- Without payment, the endpoint answers **HTTP 402** with x402 payment
  instructions (price, network, payout address).
- The agent pays in USDC; the request runs; payment **settles only when the
  read succeeds** (failed pages return 502 and are never charged).
- Extraction uses Mozilla Readability (the tech behind Firefox Reader View)
  and converts the article to Markdown.

## Research endpoint

- `POST /api/research` with `{ "question": "…" }` — **$1.00 per call**.
- Tavily runs an advanced web search and extracts the top sources; an LLM
  (OpenAI or Anthropic key, when configured) synthesizes a briefing in
  Markdown with inline citations and a source list. Without an LLM key it
  falls back to Tavily's own generated answer plus source extracts.
- Same payment rules: 402 unpaid, settles only on success, failures are
  never charged.

## Run locally

```bash
npm install
npm run dev
# Free mode: with no PAY_TO_ADDRESS set, the endpoint is unpaid.
curl -X POST http://localhost:3000/api/read \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

## Configuration (environment variables)

| Variable          | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `PAY_TO_ADDRESS`  | Coinbase Wallet address (Base) that receives payments. Unset = free mode. |
| `X402_NETWORK`    | `eip155:84532` Base Sepolia testnet (default) · `eip155:8453` Base mainnet |
| `FACILITATOR_URL` | Facilitator that verifies/settles payments (default: public testnet facilitator) |
| `PRICE`           | Price per read (default `$0.10`)                              |
| `RESEARCH_PRICE`  | Price per research call (default `$1.00`)                     |
| `TAVILY_API_KEY`  | Tavily key — required for `/api/research` (search + extraction) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Optional LLM key for briefing synthesis (first set wins) |
| `FIRECRAWL_API_KEY` | Optional fallback reader for pages the built-in reader fails on |

## Going live (checklist)

1. **Wallet**: create/open a Coinbase Wallet and copy the **Base address**
   (starts `0x…`). Never share the seed phrase with anyone — only the public
   address goes in `PAY_TO_ADDRESS`.
2. **Facilitator**: for mainnet, switch `FACILITATOR_URL` to the Coinbase CDP
   facilitator (free CDP API keys required) or another mainnet facilitator,
   and set `X402_NETWORK=eip155:8453`.
3. **Deploy**: push to GitHub, import into Vercel, set the env vars, deploy.
4. **Test**: call the endpoint unpaid → expect HTTP 402 with payment
   requirements naming your address and price. Then make one test payment.
5. **List**: in Agentic Market → Seller Tools, validate the endpoint URL and
   complete the listing. (For Coinbase Bazaar auto-indexing, add the bazaar
   discovery extension to the route config — see `app/api/read/route.ts`.)

## Stack

Next.js 16 · `@x402/next` + `@x402/evm` (x402 v2) · Mozilla Readability ·
jsdom · Turndown
