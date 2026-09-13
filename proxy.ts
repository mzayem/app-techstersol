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
  // exists.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|verify|credentials|manifest.webmanifest|icon.png|apple-icon.png|icons/|images/).*)",
  ],
};
