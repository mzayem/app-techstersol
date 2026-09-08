"use client";

import { ChevronsUpDown } from "lucide-react";
import { UserAvatar, UserButton, useAuthenticate } from "@neondatabase/auth-ui";

import { authClient } from "@/lib/auth-client";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useMounted } from "@/lib/hooks/use-mounted";

export function NavUser() {
  const authState = useAuthenticate({ authClient });
  // `useAuthenticate` is a client-only hook — it can resolve an
  // already-cached session synchronously on the client's very first render,
  // before the server (which has no such cache) ever could, so that first
  // render can already disagree with the SSR'd HTML. Force the same
  // "still loading" state SSR renders until hydration completes, then let
  // the real session take over.
  const mounted = useMounted();
  const user = mounted ? authState.user : undefined;
  const isPending = mounted ? authState.isPending : true;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserButton
          size="lg"
          className="w-full"
          trigger={
            <SidebarMenuButton size="lg">
              <UserAvatar
                user={user}
                isPending={isPending}
                className="size-8 rounded-lg"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {user?.name ?? "Profile"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email ?? "Manage your account"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          }
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
