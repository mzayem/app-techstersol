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
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "../ui/separator";

export function AppSidebar({
  visiblePages,
  ...props
}: React.ComponentProps<typeof Sidebar> & { visiblePages: PageKey[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const visible = new Set(visiblePages);
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => visible.has(item.key)),
    }))
    .filter((group) => group.items.length > 0);

  // The sidebar is a full-screen overlay on mobile — after tapping a link
  // it's navigating away anyway, so leaving the drawer open just blocks the
  // page underneath until the user dismisses it themselves.
  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" onClick={closeOnMobile} />}
            >
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
                  render={<Link href={navMain.url} onClick={closeOnMobile} />}
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
                      render={<Link href={item.url} onClick={closeOnMobile} />}
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
