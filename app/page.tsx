const PRICE = process.env.PRICE ?? "$0.10";
const READ_LITE_PRICE = process.env.READ_LITE_PRICE ?? "$0.005";
const RESEARCH_PRICE = process.env.RESEARCH_PRICE ?? "$1.00";

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

      <h2 style={{ marginTop: 40 }}>Lite endpoint — for high-volume loops</h2>
      <p>
        Same page in, same clean Markdown out, at a loop-friendly price.
        Built for agents that read pages continuously — no research
        synthesis, just the extraction.
      </p>
      <pre
        style={{
          background: "#12161f",
          border: "1px solid #232a38",
          borderRadius: 8,
          padding: 16,
          overflowX: "auto",
        }}
      >
        {`POST /api/read-lite
Content-Type: application/json

{ "url": "https://example.com/some-article" }`}
      </pre>
      <p>
        The response is identical in shape to <code>/api/read</code> —
        <code>url</code>, <code>title</code>, <code>excerpt</code>,{" "}
        <code>markdown</code>, and <code>wordCount</code>. Failed reads are
        never charged.
      </p>

      <h2 style={{ marginTop: 40 }}>Research endpoint</h2>
      <p>
        Don&apos;t fetch pages one by one — ask the question and get the
        finished answer. The research endpoint searches the web, reads the
        top sources, and returns a briefing in Markdown with citations.
      </p>
      <pre
        style={{
          background: "#12161f",
          border: "1px solid #232a38",
          borderRadius: 8,
          padding: 16,
          overflowX: "auto",
        }}
      >
        {`POST /api/research
Content-Type: application/json

{ "question": "What are the current US federal EV tax credit rules?" }`}
      </pre>
      <p>
        The response carries the <code>briefing</code> (Markdown, with inline
        citations and a source list), the <code>sources</code> used, and a{" "}
        <code>wordCount</code>. Failed research runs are never charged.
      </p>

      <h2 style={{ marginTop: 40 }}>Pricing</h2>
      <p>
        <strong>{PRICE} per read</strong>,{" "}
        <strong>{READ_LITE_PRICE} per lite read</strong>, and{" "}
        <strong>{RESEARCH_PRICE} per research call</strong>, paid in USDC on
        Base via the{" "}
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
