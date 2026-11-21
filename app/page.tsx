const PRICE = process.env.PRICE ?? "$0.10";

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "64px 24px 96px",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 40, margin: "0 0 8px" }}>WebReader</h1>
      <p style={{ fontSize: 20, color: "#9aa4b2", margin: "0 0 32px" }}>
        Any web page in. Clean, AI-readable Markdown out.
      </p>

      <p>
        WebReader is a pay-per-call service for AI agents. Agents can&apos;t
        read most web pages — they&apos;re buried in ads, popups, and layout
        markup. WebReader fetches the page, extracts the main content, and
        returns tidy Markdown an agent can actually use.
      </p>

      <h2 style={{ marginTop: 40 }}>Endpoint</h2>
      <pre
        style={{
          background: "#12161f",
          border: "1px solid #232a38",
          borderRadius: 8,
          padding: 16,
          overflowX: "auto",
        }}
      >
        {`POST /api/read
Content-Type: application/json

{ "url": "https://example.com/some-article" }`}
      </pre>

      <h2 style={{ marginTop: 40 }}>Response</h2>
      <pre
        style={{
          background: "#12161f",
          border: "1px solid #232a38",
          borderRadius: 8,
          padding: 16,
          overflowX: "auto",
        }}
      >
        {`{
  "url": "https://example.com/some-article",
  "title": "The Article Title",
  "excerpt": "A short summary of the page…",
  "markdown": "# The Article Title\\n\\nThe full article text…",
  "wordCount": 842
}`}
      </pre>

      <h2 style={{ marginTop: 40 }}>Pricing</h2>
      <p>
        <strong>{PRICE} per read</strong>, paid in USDC on Base via the{" "}
        <a
          href="https://x402.org"
          style={{ color: "#6ea8fe" }}
          target="_blank"
          rel="noreferrer"
        >
          x402 protocol
        </a>
        . No API key, no account, no subscription. Call without payment and
        you&apos;ll get an HTTP 402 with payment instructions; pay, retry, and
        the page is yours. Failed reads are never charged.
      </p>
    </main>
  );
}
