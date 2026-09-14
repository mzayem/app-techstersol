"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOutIcon, UserCircleIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const chars =
    parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0] ?? "?"];
  return chars.join("").toUpperCase();
}

/** Deliberately doesn't use @neondatabase/auth-ui's UserAvatar/UserButton.
 * Those resolve the displayed name internally via a
 * `user.displayName || user.name || ...` fallback chain that — with no
 * plain string for `displayName` — appears to trigger a genuine network
 * request during render (`GET /api/auth/display-name/to-string` etc.,
 * because the SDK's client is Proxy-based and something coerces that
 * property to a string), producing a hydration mismatch and unhandled
 * rejections on every single page, since this renders in every sidebar.
 * Built our own instead, fed by the already-resolved AppUser record every
 * layout has anyway — no client-side session read needed to just display a
 * name/email, only for the imperative sign-out call below. */
export function NavUser({
  name,
  email,
  profileHref,
}: {
  name: string;
  email: string;
  /** Where this login's own profile/account page lives — differs per
   * portal (e.g. `/portal/profile/settings` vs `/profile/settings`). */
  profileHref: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      router.push("/auth/sign-in");
      router.refresh();
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<a href={profileHref} />}>
              <UserCircleIcon />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} disabled={signingOut}>
              <LogOutIcon />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
