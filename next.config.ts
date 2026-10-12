import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isProd = process.env.NODE_ENV === "production";

/** Content-Security-Policy for app pages. Kept compatible with how the app
 * actually loads things:
 * - scripts: Next's inline bootstrap + the PWA splash script in
 *   app/layout.tsx need 'unsafe-inline' (no nonce setup); dev-mode React
 *   needs 'unsafe-eval' for its debugging stack traces.
 * - images/fonts: https: is allowed because email bodies (shown in a
 *   sandboxed srcdoc iframe on the Emails page, which inherits this policy)
 *   and Google profile pictures load from other sites.
 * - connect: the auth client talks to this app's own /api/auth proxy, so
 *   'self' is enough.
 * frame-ancestors 'none' stops the app being embedded (clickjacking). */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  "worker-src 'self' blob:",
  "frame-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  // Clickjacking: older browsers ignore CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]
    : []),
];

const nextConfig: NextConfig = {
  // Don't announce "X-Powered-By: Next.js".
  poweredByHeader: false,
  images: {
    qualities: [75, 90, 95, 100],
  },
  turbopack: {},
  outputFileTracingIncludes: {
    "/*": ["node_modules/pdfkit/js/**/*", "node_modules/pdfkit/package.json"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Pages only — not /api, whose PDF downloads open in the browser's
      // built-in viewer, which a strict CSP on that response can break.
      {
        source: "/((?!api/).*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
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
