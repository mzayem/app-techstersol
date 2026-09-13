import { ClientContractRequestDialog } from "@/components/client-portal/client-contract-request-dialog";
import { ClientContractsFilterBar } from "@/components/client-portal/client-contracts-filter-bar";
import { ContractStatusStepper } from "@/components/client-portal/contract-status-stepper";
import { StatTile } from "@/components/client-portal/stat-breakdown";
import { ContractChatButton } from "@/components/contracts/contract-chat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { formatContractAmount } from "@/lib/contracts/constants";
import { getActiveClientProfiles, requireClientUser } from "@/lib/rbac/permissions";
import { getClientOverview, listMyContracts } from "@/actions/client-portal/queries";

export const dynamic = "force-dynamic";

export default async function ClientContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireClientUser();
  const profiles = getActiveClientProfiles(appUser);
  const params = await searchParams;
  const isMultiProfile = profiles.length > 1;

  const [overview, contracts] = await Promise.all([
    getClientOverview(profiles),
    listMyContracts(profiles, { search: params.q, profileClientId: params.profile }),
  ]);
  const paginated = paginate(contracts, parsePageParam(params.page), parsePageSizeParam(params.pageSize));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Your projects with us. Add a note any time — our team sees it right away.
          </p>
        </div>
        <ClientContractRequestDialog profiles={profiles} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Total projects"
          value={String(overview.totalProjects)}
          breakdown={overview.totalProjectsByProfile.map((p) => ({
            label: p.clientName,
            value: String(p.value),
          }))}
        />
        <StatTile
          label="Completed"
          value={String(overview.completedProjects)}
          breakdown={overview.completedProjectsByProfile.map((p) => ({
            label: p.clientName,
            value: String(p.value),
          }))}
        />
        <StatTile
          label="Pending"
          value={String(overview.pendingProjects)}
          breakdown={overview.pendingProjectsByProfile.map((p) => ({
            label: p.clientName,
            value: String(p.value),
          }))}
        />
      </div>

      <ClientContractsFilterBar profiles={profiles} />

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              {isMultiProfile && <TableHead>Profile</TableHead>}
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isMultiProfile ? 6 : 5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No projects found.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((contract) => {
              const total =
                contract.paymentType === "PROJECT"
                  ? (contract.amount ?? 0)
                  : contract.milestones.reduce((sum, m) => sum + m.amount, 0);
              return (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    {contract.projectName}
                    {contract.description && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {contract.description}
                      </span>
                    )}
                  </TableCell>
                  {isMultiProfile && (
                    <TableCell className="text-muted-foreground">{contract.clientName}</TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {formatDate(contract.deadline)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatContractAmount(total, contract.currency)}
                  </TableCell>
                  <TableCell>
                    <ContractStatusStepper status={contract.status} />
                  </TableCell>
                  <TableCell>
                    <ContractChatButton
                      contractId={contract.id}
                      projectName={contract.projectName}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
