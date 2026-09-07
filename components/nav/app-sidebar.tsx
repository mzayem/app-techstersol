"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navGroups, navMain } from "@/components/nav/nav-data";
import { NavUser } from "@/components/nav/nav-user";
import { ModeToggle } from "@/components/ui/mode-toggle";
import type { PageKey } from "@/lib/rbac/pages";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Separator } from "../ui/separator";

export function AppSidebar({
  visiblePages,
  ...props
}: React.ComponentProps<typeof Sidebar> & { visiblePages: PageKey[] }) {
  const pathname = usePathname();
  const visible = new Set(visiblePages);
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => visible.has(item.key)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <Image
                src="/images/icon.webp"
                alt=""
                width={121}
                height={80}
                className="size-6 w-auto"
              />
              <span className="truncate uppercase font-medium text-lg">
                Techster<span className="font-bold">sol</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Separator />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === navMain.url}
                  tooltip={navMain.title}
                  render={<Link href={navMain.url} />}
                >
                  <navMain.icon />
                  <span>{navMain.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      render={<Link href={item.url} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ModeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
