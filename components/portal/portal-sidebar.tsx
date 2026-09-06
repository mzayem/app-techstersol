"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  ReceiptText,
  UserCircle,
} from "lucide-react";

import { NavUser } from "@/components/nav/nav-user";
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
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const PORTAL_NAV = [
  { title: "Overview", url: "/portal", icon: LayoutDashboard },
  { title: "My Projects", url: "/portal/projects", icon: FolderKanban },
  { title: "Work Diary", url: "/portal/work-diary", icon: CalendarDays, hourlyOnly: true },
  { title: "Payslips", url: "/portal/payslips", icon: ReceiptText },
  { title: "Profile", url: "/portal/profile/settings", icon: UserCircle },
];

export function PortalSidebar({
  showWorkDiary,
  ...props
}: React.ComponentProps<typeof Sidebar> & { showWorkDiary: boolean }) {
  const pathname = usePathname();
  const navItems = PORTAL_NAV.filter((item) => !item.hourlyOnly || showWorkDiary);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/portal" />}>
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
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={
                      pathname === item.url ||
                      (item.url !== "/portal" && pathname.startsWith(item.url))
                    }
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
