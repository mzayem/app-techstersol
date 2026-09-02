"use client";

import { ChevronsUpDown } from "lucide-react";
import { UserAvatar, UserButton, useAuthenticate } from "@neondatabase/auth-ui";

import { authClient } from "@/lib/auth-client";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavUser() {
  const { user, isPending } = useAuthenticate({ authClient });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserButton
          size="lg"
          className="w-full"
          trigger={
            <SidebarMenuButton size="lg">
              <UserAvatar user={user} isPending={isPending} className="size-8 rounded-lg" />
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
