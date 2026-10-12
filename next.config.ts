import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90, 95, 100],
  },
  turbopack: {},
  outputFileTracingIncludes: {
    "/*": ["node_modules/pdfkit/js/**/*", "node_modules/pdfkit/package.json"],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Registration is opt-in (see the Data & Offline settings toggle), so the
  // build must not auto-register the worker for every visitor.
  register: false,
  // Turbopack (this app's default bundler) isn't supported by @serwist/next
  // — only disable the plugin's webpack hook outside of a real production
  // build, which is run with `next build --webpack` (see package.json).
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist(nextConfig);
