import { ContractDialog } from "@/components/contracts/contract-dialog";
import { ContractFilterBar } from "@/components/contracts/contract-filter-bar";
import {
  ContractTable,
  type ContractListItem,
} from "@/components/contracts/contract-table";
import { ExportReportDialog } from "@/components/reports/export-report-dialog";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type {
  ContractPaymentType,
  ContractStatus,
} from "@/lib/contracts/constants";
import {
  listClientOptions,
  listContracts,
  listPartnerOptions,
  type SortOption,
} from "@/actions/contracts/queries";
import { listTeamMemberOptions } from "@/actions/team/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { permission } = await requirePagePermission("contracts");
  const params = await searchParams;

  const [contracts, clients, teamMembers, partners] = await Promise.all([
    listContracts({
      search: params.q,
      status: params.status as ContractStatus | undefined,
      sort: params.sort as SortOption | undefined,
    }),
    listClientOptions(),
    listTeamMemberOptions(),
    listPartnerOptions(),
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

  const items: ContractListItem[] = contracts.map((contract) => {
    const milestones = contract.milestones.map((m) => ({
      name: m.name,
      amount: Number(m.amount),
      deadline: m.deadline,
    }));
    const amount = contract.amount ? Number(contract.amount) : null;
    const totalAmount =
      contract.paymentType === "MILESTONE"
        ? milestones.reduce((sum, m) => sum + m.amount, 0)
        : (amount ?? 0);

    const projectExpenses = contract.projectExpenses.map((e) => ({
      id: e.id,
      date: e.date,
      name: e.name,
      amount: Number(e.amount),
    }));

    return {
      id: contract.id,
      clientId: contract.clientId,
      clientName: contract.client.name,
      clientEmail: contract.client.email,
      date: contract.date,
      deadline: contract.deadline,
      projectName: contract.projectName,
      description: contract.description,
      currency: contract.currency as PaymentCurrency,
      paymentType: contract.paymentType as ContractPaymentType,
      amount,
      status: contract.status as ContractStatus,
      teamMemberId: contract.teamMemberId,
      teamPayAmount: contract.teamPayAmount
        ? Number(contract.teamPayAmount)
        : null,
      statusEmailsEnabled: contract.statusEmailsEnabled,
      chatNotificationsEnabled: contract.chatNotificationsEnabled,
      partnerId: contract.partnerId,
      workCostMode: contract.workCostMode,
      workCostPercent: contract.workCostPercent
        ? Number(contract.workCostPercent)
        : null,
      partnerSharePercent: contract.partnerSharePercent
        ? Number(contract.partnerSharePercent)
        : null,
      milestones,
      projectExpenses,
      totalAmount,
      paidAmount: contract.paidAmount,
    };
  });
  const paginated = paginate(
    items,
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Contracts</h1>
        <div className="flex items-center gap-2">
          <ExportReportDialog module="contracts" label="contracts" />
          {permission.canCreate && (
            <ContractDialog
              clients={clientOptions}
              teamMembers={teamMembers}
              partners={partnerOptions}
            />
          )}
        </div>
      </div>

      <ContractFilterBar />

      <ContractTable
        contracts={paginated.items}
        clients={clientOptions}
        teamMembers={teamMembers}
        partners={partnerOptions}
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
