import Link from "next/link";

import { PartnerEarningsChart } from "@/components/partner-portal/partner-earnings-chart";
import { PartnerClientRevenueChart } from "@/components/partner-portal/partner-client-revenue-chart";
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
import { formatPkr } from "@/lib/finance/constants";
import { formatContractAmount, CONTRACT_STATUS_LABELS } from "@/lib/contracts/constants";
import { requirePartnerUser } from "@/lib/rbac/permissions";
import { getPartnerOverview, listPartnerContracts } from "@/actions/partner-portal/queries";

export const dynamic = "force-dynamic";

const OVERVIEW_ROW_LIMIT = 8;

export default async function PartnerPortalOverviewPage() {
  const appUser = await requirePartnerUser();
  const partner = appUser.partner!;
  const [overview, contracts] = await Promise.all([
    getPartnerOverview(partner.id),
    listPartnerContracts(partner.id),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Welcome, {partner.name}</h1>
        <p className="text-sm text-muted-foreground">
          Your projects, earnings, and payslips at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Paid this year" value={formatPkr(overview.paidThisYearPkr)} />
        <StatTile label="Pending" value={formatPkr(overview.pendingPkr)} />
        <StatTile
          label="Projects"
          value={String(overview.activeProjects + overview.completedProjects)}
          breakdown={[
            { label: "Active", value: String(overview.activeProjects) },
            { label: "Completed", value: String(overview.completedProjects) },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PartnerEarningsChart series={overview.monthlyEarnings} />
        <PartnerClientRevenueChart data={overview.revenueByClient} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Your projects</h2>
          {contracts.length > OVERVIEW_ROW_LIMIT && (
            <Link
              href="/partner-portal/projects"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          )}
        </div>
        <div className="rounded-md bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No projects assigned to you yet.
                  </TableCell>
                </TableRow>
              )}
              {contracts.slice(0, OVERVIEW_ROW_LIMIT).map((contract) => {
                const total =
                  contract.paymentType === "PROJECT"
                    ? (contract.amount ?? 0)
                    : contract.milestones.reduce((sum, m) => sum + m.amount, 0);
                return (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.projectName}</TableCell>
                    <TableCell className="text-muted-foreground">{contract.clientName}</TableCell>
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
        </div>
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
