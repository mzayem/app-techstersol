import { RecurringServicesTable } from "@/components/contracts/recurring-services-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { contractAmountLabel } from "@/lib/contracts/constants";
import {
  getActiveClientProfiles,
  requireClientUser,
} from "@/lib/rbac/permissions";
import { listMyContracts } from "@/actions/client-portal/queries";

export const dynamic = "force-dynamic";

export default async function ClientServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireClientUser();
  const profiles = getActiveClientProfiles(appUser);
  const params = await searchParams;

  const services = await listMyContracts(profiles, { kind: "recurring" });
  const paginated = paginate(
    services,
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Services</h1>
        <p className="text-sm text-muted-foreground">
          Your ongoing services with us. An invoice for each billing period is
          emailed to you automatically — download your service agreement any
          time.
        </p>
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <RecurringServicesTable
          showClient={profiles.length > 1}
          rows={paginated.items.map((s) => ({
            id: s.id,
            number: s.number,
            projectName: s.projectName,
            description: s.description,
            clientName: s.clientName,
            date: s.date,
            deadline: s.deadline,
            billing: contractAmountLabel(s),
            nextInvoiceDate: s.nextInvoiceDate,
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
