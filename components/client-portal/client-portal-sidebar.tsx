"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, LayoutDashboard, ReceiptText, Settings, UserCircle } from "lucide-react";

import { NavUser } from "@/components/nav/nav-user";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const CLIENT_NAV = [
  { title: "Overview", url: "/client-portal", icon: LayoutDashboard },
  { title: "Contracts", url: "/client-portal/contracts", icon: FolderKanban },
  { title: "Invoices", url: "/client-portal/invoices", icon: ReceiptText },
  { title: "Profile", url: "/client-portal/profile/settings", icon: UserCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function ClientPortalSidebar({
  userName,
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & { userName: string; userEmail: string }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

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
              render={<Link href="/client-portal" onClick={closeOnMobile} />}
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
              {CLIENT_NAV.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={
                      pathname === item.url ||
                      (item.url !== "/client-portal" && pathname.startsWith(item.url))
                    }
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ModeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser name={userName} email={userEmail} profileHref="/client-portal/profile/settings" />
      </SidebarFooter>
    </Sidebar>
  );
}
