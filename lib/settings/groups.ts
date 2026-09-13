// Settings groups listed on /settings, each with its own page under
// /settings/<key> (e.g. /settings/data-offline). Add an entry here plus a
// app/settings/<key>/page.tsx to extend Settings — the shared layout, guard,
// and nav links don't need to change for a new group. A group page is open
// to every signed-in kind by default (the shared layout only checks "is
// logged in"); a future group that needs stricter access can add its own
// check at the top of its page.tsx, the same way any other page in the app
// does, without affecting the others.
export const SETTINGS_GROUPS = [
  {
    key: "data-offline",
    title: "Data & Offline",
    description: "Control local storage and offline access on this device.",
    href: "/settings/data-offline",
  },
] as const;

export type SettingsGroupKey = (typeof SETTINGS_GROUPS)[number]["key"];
