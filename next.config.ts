import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsdom is a native-ish server dependency; keep it out of the bundle.
  serverExternalPackages: ["jsdom"],
};

export default nextConfig;
