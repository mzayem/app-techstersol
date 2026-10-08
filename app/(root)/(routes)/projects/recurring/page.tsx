import { ContractDialog } from "@/components/contracts/contract-dialog";
import { ContractFilterBar } from "@/components/contracts/contract-filter-bar";
import { ContractTable } from "@/components/contracts/contract-table";
import { ExportReportDialog } from "@/components/reports/export-report-dialog";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type { ContractStatus } from "@/lib/contracts/constants";
import { toContractListItem } from "@/lib/contracts/list-item";
import {
  listBankAccountOptions,
  listClientOptions,
  listContracts,
  listPartnerOptions,
  type SortOption,
} from "@/actions/contracts/queries";
import { listTeamMemberOptions } from "@/actions/team/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function RecurringContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { permission } = await requirePagePermission("contracts");
  const params = await searchParams;

  const [contracts, clients, teamMembers, partners, bankAccounts] =
    await Promise.all([
      listContracts({
        kind: "recurring",
        search: params.q,
        status: params.status as ContractStatus | undefined,
        sort: params.sort as SortOption | undefined,
      }),
      listClientOptions(),
      listTeamMemberOptions(),
      listPartnerOptions(),
      listBankAccountOptions(),
    ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    currency: c.currency as PaymentCurrency,
    emailNotificationsEnabled: c.emailNotificationsEnabled,
  }));

  const partnerOptions = partners.map((p) => ({
    id: p.id,
    name: p.name,
    sharePercentage: Number(p.sharePercentage),
    currency: p.currency as PaymentCurrency,
  }));

  const bankAccountOptions = bankAccounts.map((b) => ({
    ...b,
    currency: b.currency as PaymentCurrency,
  }));

  const paginated = paginate(
    contracts.map(toContractListItem),
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Recurring Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Retainers and subscriptions — invoiced and emailed automatically
            every billing cycle while active.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportReportDialog module="recurring" label="recurring contracts" />
          {permission.canCreate && (
            <ContractDialog
              clients={clientOptions}
              teamMembers={teamMembers}
              partners={partnerOptions}
              bankAccounts={bankAccountOptions}
              variant="recurring"
            />
          )}
        </div>
      </div>

      <ContractFilterBar variant="recurring" />

      <ContractTable
        contracts={paginated.items}
        clients={clientOptions}
        teamMembers={teamMembers}
        partners={partnerOptions}
        bankAccounts={bankAccountOptions}
        variant="recurring"
        canEdit={permission.canEdit}
        canDelete={permission.canDelete}
        pagination={{
          page: paginated.page,
          totalPages: paginated.totalPages,
          totalItems: paginated.totalItems,
          pageSize: paginated.pageSize,
        }}
      />
    </div>
  );
}
