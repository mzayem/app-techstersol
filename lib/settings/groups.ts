import type { PageKey } from "@/lib/rbac/pages";

// Settings groups listed on /settings, each with its own page under
// /settings/<key> (e.g. /settings/data-offline). Add an entry here plus a
// app/settings/<key>/page.tsx to extend Settings — the shared layout, guard,
// and nav links don't need to change for a new group. A group page is open
// to every signed-in kind by default (the shared layout only checks "is
// logged in"); a group that needs stricter access sets `requiresPage` (it's
// then hidden from the list unless the viewer's role can view that page) and
// its page.tsx must enforce the same permission itself, e.g. via
// requirePagePermission.
export type SettingsGroup = {
  key: string;
  title: string;
  description: string;
  href: string;
  requiresPage?: PageKey;
};

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    key: "data-offline",
    title: "Data & Offline",
    description: "Control local storage and offline access on this device.",
    href: "/settings/data-offline",
  },
  {
    key: "api-credentials",
    title: "API Credentials",
    description:
      "Issue and revoke the keys other software uses to push earnings here.",
    href: "/settings/api-credentials",
    requiresPage: "api-keys",
  },
  {
    key: "api-docs",
    title: "API Documentation",
    description:
      "Endpoint reference for the earnings API: fields, responses and examples.",
    href: "/settings/api-docs",
    requiresPage: "api-keys",
  },
];

export type SettingsGroupKey = (typeof SETTINGS_GROUPS)[number]["key"];
