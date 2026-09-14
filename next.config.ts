import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    qualities: [75, 90, 95, 100],
  },
  // @serwist/next always adds a `webpack()` hook to the config (even though
  // it's a no-op here in dev, see `disable` below) — without this, Next 16
  // hard-errors under `next dev`'s default Turbopack bundler, thinking an
  // unmigrated webpack config was left behind by mistake.
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
