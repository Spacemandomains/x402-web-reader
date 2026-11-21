import type { ReactNode } from "react";

export const metadata = {
  title: "WebReader — pay-per-call page reading for AI agents",
  description:
    "Send any URL, get clean AI-readable Markdown back. Paid per call via x402 in USDC on Base. No API key, no account.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0b0e14",
          color: "#e6e9ef",
        }}
      >
        {children}
      </body>
    </html>
  );
}
