import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf ships its own font/stream handling and must not be bundled.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
