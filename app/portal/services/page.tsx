import { RecurringServicesTable } from "@/components/contracts/recurring-services-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { requireTeamUser } from "@/lib/rbac/permissions";
import { listMyProjects } from "@/actions/portal/queries";

export const dynamic = "force-dynamic";

export default async function PortalServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireTeamUser();
  const params = await searchParams;
  const services = await listMyProjects(appUser.teamMember!.id, "recurring");
  const paginated = paginate(
    services,
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">My Services</h1>
        <p className="text-sm text-muted-foreground">
          Ongoing services assigned to you — service name and dates only.
        </p>
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <RecurringServicesTable
          showBilling={false}
          showAgreement={false}
          chatReadOnly
          emptyText="No recurring services assigned to you yet."
          rows={paginated.items.map((s) => ({
            id: s.id,
            number: s.number,
            projectName: s.projectName,
            description: null,
            date: s.date,
            deadline: s.deadline,
            nextInvoiceDate: null,
            status: s.status,
          }))}
        />
        <TablePagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          totalItems={paginated.totalItems}
          pageSize={paginated.pageSize}
        />
      </div>
    </div>
  );
}
