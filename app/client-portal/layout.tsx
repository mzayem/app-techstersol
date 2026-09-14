import { ClientPortalSidebar } from "@/components/client-portal/client-portal-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireClientUser } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await requireClientUser();

  return (
    <SidebarProvider>
      <ClientPortalSidebar
        userName={appUser.name}
        userEmail={appUser.email}
        userImage={appUser.image}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
