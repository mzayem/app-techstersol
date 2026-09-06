import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  // manifest.webmanifest/icon.png/apple-icon.png/icons/* must be reachable
  // without a session — a browser can't treat the site as installable if
  // fetching the manifest gets redirected to the sign-in page instead of
  // returning JSON.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|verify|manifest.webmanifest|icon.png|apple-icon.png|icons/).*)",
  ],
};
