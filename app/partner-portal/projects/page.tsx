import { PartnerContractRequestDialog } from "@/components/partner-portal/partner-contract-request-dialog";
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
import { CONTRACT_STATUS_LABELS, formatContractAmount } from "@/lib/contracts/constants";
import { requirePartnerUser } from "@/lib/rbac/permissions";
import {
  listPartnerClientOptions,
  listPartnerContracts,
} from "@/actions/partner-portal/queries";
import { listTeamMemberOptions } from "@/actions/team/queries";

export const dynamic = "force-dynamic";

const HIDDEN_CONTACT_LABEL = "Hidden — ask your account manager";

export default async function PartnerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requirePartnerUser();
  const partner = appUser.partner!;
  const params = await searchParams;

  const [contracts, clientOptions, teamMembers] = await Promise.all([
    listPartnerContracts(partner.id),
    listPartnerClientOptions(partner.id),
    listTeamMemberOptions(),
  ]);
  const paginated = paginate(contracts, parsePageParam(params.page), parsePageSizeParam(params.pageSize));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Projects you profit-share on. Propose a new one any time.
          </p>
        </div>
        <PartnerContractRequestDialog
          clients={clientOptions}
          teamMembers={teamMembers.map((m) => ({ id: m.id, name: m.name }))}
          sharePercentage={Number(partner.sharePercentage)}
        />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No projects yet — propose one to get started.
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
                  <TableCell className="text-muted-foreground">{contract.clientName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {contract.clientPhone ?? (
                      <span className="italic">{HIDDEN_CONTACT_LABEL}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contract.clientEmail ?? (
                      <span className="italic">{HIDDEN_CONTACT_LABEL}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(contract.deadline)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatContractAmount(total, contract.currency)}
                  </TableCell>
                  <TableCell>{CONTRACT_STATUS_LABELS[contract.status]}</TableCell>
                  <TableCell>
                    <ContractChatButton
                      contractId={contract.id}
                      projectName={contract.projectName}
                      readOnly={!partner.chatEnabled}
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
