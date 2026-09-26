import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/nav/app-sidebar";
import { CommandSearch } from "@/components/nav/command-search";
import { SyncStatus } from "@/components/offline/sync-status";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCurrentAppUser, getVisiblePages } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/sign-in");
  if (appUser.kind === "TEAM") redirect("/portal");
  if (appUser.kind === "CLIENT") redirect("/client-portal");
  if (appUser.kind === "PARTNER") redirect("/partner-portal");

  const visiblePages = getVisiblePages(appUser);

  return (
    <SidebarProvider>
      <AppSidebar
        visiblePages={visiblePages}
        userName={appUser.name}
        userEmail={appUser.email}
        userImage={appUser.image}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <div className="ml-auto flex items-center gap-2">
            <SyncStatus />
            <CommandSearch visiblePages={visiblePages} />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
