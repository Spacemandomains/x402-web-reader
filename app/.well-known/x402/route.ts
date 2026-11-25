import { NextResponse } from "next/server";

// x402 discovery fan-out (compatibility format used by x402scan,
// Agent402, and other catalogs): the paid resources this origin offers.
const ORIGIN = "https://x402-web-reader.vercel.app";

export async function GET() {
  return NextResponse.json({
    version: 1,
    resources: [
      `${ORIGIN}/api/read`,
      `${ORIGIN}/api/read-lite`,
      `${ORIGIN}/api/deal-verdict`,
      `${ORIGIN}/api/research`,
    ],
  });
}
