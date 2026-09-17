import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf ships its own font/stream handling and must not be bundled.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Next's file tracing misses yoga-layout's entry point (`dist/src/index.js`),
  // which @react-pdf/layout requires. Everything else in the package gets
  // traced, so the omission is invisible until the serverless function tries to
  // boot: `require('yoga-layout')` throws MODULE_NOT_FOUND and the report route
  // returns a bare 502 rather than an error this app can catch and retry.
  // pdfkit's standard font metrics are loaded by path at render time, and
  // tracing only picks up the .mjs variants — the CJS runtime asks for
  // standard-fonts/Helvetica.cjs and gets MODULE_NOT_FOUND.
  outputFileTracingIncludes: {
    "/api/report": ["./node_modules/yoga-layout/**/*", "./node_modules/pdfkit/**/*"],
  },
};

export default nextConfig;
