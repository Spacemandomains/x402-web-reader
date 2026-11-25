import type { NextConfig } from "next";

// CORS: browser-based agents must be able to READ the x402
// PAYMENT-REQUIRED challenge header on a 402 and the PAYMENT-RESPONSE
// receipt header on a settled call — both are blocked cross-origin
// unless explicitly exposed. Mirrors CryptoIntel's next.config.ts.
const corsHeaders = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
  {
    key: "Access-Control-Allow-Headers",
    value: "Content-Type, Authorization, PAYMENT-SIGNATURE, X-PAYMENT",
  },
  {
    key: "Access-Control-Expose-Headers",
    value: "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
  },
];

const nextConfig: NextConfig = {
  // jsdom is a native-ish server dependency; keep it out of the bundle.
  serverExternalPackages: ["jsdom"],
  async headers() {
    return [
      { source: "/api/:path*", headers: corsHeaders },
      { source: "/.well-known/:path*", headers: corsHeaders },
      { source: "/openapi.json", headers: corsHeaders },
      { source: "/llms.txt", headers: corsHeaders },
    ];
  },
};

export default nextConfig;
