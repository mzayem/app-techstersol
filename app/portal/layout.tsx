import { PortalSidebar } from "@/components/portal/portal-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireTeamUser } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await requireTeamUser();

  return (
    <SidebarProvider>
      <PortalSidebar showWorkDiary={appUser.teamMember!.type === "HOURLY"} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
