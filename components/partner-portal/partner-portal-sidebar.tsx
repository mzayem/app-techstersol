"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  ReceiptText,
  Settings,
  UserCircle,
  WalletCards,
} from "lucide-react";

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

const PARTNER_NAV = [
  { title: "Overview", url: "/partner-portal", icon: LayoutDashboard },
  { title: "Projects", url: "/partner-portal/projects", icon: FolderKanban },
  { title: "Invoices", url: "/partner-portal/invoices", icon: ReceiptText },
  { title: "Payslips", url: "/partner-portal/payslips", icon: WalletCards },
  { title: "Profile", url: "/partner-portal/profile/settings", icon: UserCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function PartnerPortalSidebar({
  userName,
  userEmail,
  userImage,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userName: string;
  userEmail: string;
  userImage?: string | null;
}) {
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
              render={<Link href="/partner-portal" onClick={closeOnMobile} />}
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
              {PARTNER_NAV.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={
                      pathname === item.url ||
                      (item.url !== "/partner-portal" && pathname.startsWith(item.url))
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
        <NavUser
          name={userName}
          email={userEmail}
          image={userImage}
          profileHref="/partner-portal/profile/settings"
        />
      </SidebarFooter>
    </Sidebar>
  );
}
