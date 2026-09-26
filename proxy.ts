import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  // manifest.webmanifest/icon.png/apple-icon.png/icons/* must be reachable
  // without a session — a browser can't treat the site as installable if
  // fetching the manifest gets redirected to the sign-in page instead of
  // returning JSON. images/* (public/images) must be excluded too, since
  // the sign-in page itself renders a logo from there before a session
  // exists. sw.js needs the same treatment: service worker registration
  // requires the script response to actually be JS, not a redirect to the
  // sign-in page — this can be hit signed-out too (e.g. a stale service
  // worker checking for updates after the session ends). api/cron/* is
  // called by the scheduler with no session — each route checks
  // CRON_SECRET itself instead.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|verify|credentials|api/cron|manifest.webmanifest|icon.png|apple-icon.png|icons/|images/|sw.js).*)",
  ],
};
