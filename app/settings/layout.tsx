import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/nav/app-sidebar";
import { ClientPortalSidebar } from "@/components/client-portal/client-portal-sidebar";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PartnerPortalSidebar } from "@/components/partner-portal/partner-portal-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentAppUser, getVisiblePages } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

/** Settings is intentionally open to every signed-in kind — dashboard
 * handler, team, client, and partner alike — with no page-permission
 * check, unlike every other route in the app. It lives outside
 * (root)/portal/client-portal/partner-portal (since each of those layouts
 * redirects the other kinds away) but still renders the same sidebar each
 * kind already sees on their own pages, picked here by kind instead of by
 * which route tree the page happens to sit under. */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/sign-in");

  const userName = appUser.name;
  const userEmail = appUser.email;
  const userImage = appUser.image;

  const sidebar =
    appUser.kind === "TEAM" ? (
      <PortalSidebar
        showWorkDiary={appUser.teamMember?.type === "HOURLY"}
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
      />
    ) : appUser.kind === "CLIENT" ? (
      <ClientPortalSidebar userName={userName} userEmail={userEmail} userImage={userImage} />
    ) : appUser.kind === "PARTNER" ? (
      <PartnerPortalSidebar userName={userName} userEmail={userEmail} userImage={userImage} />
    ) : (
      <AppSidebar
        visiblePages={getVisiblePages(appUser)}
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
      />
    );

  return (
    <SidebarProvider>
      {sidebar}
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
