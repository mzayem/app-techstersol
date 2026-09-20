import { PartnerInvestmentDialog } from "@/components/partners/partner-investment-dialog";
import { PartnerInvestmentRowActions } from "@/components/partners/partner-investment-row-actions";
import { PartnerInvestmentSpendDialog } from "@/components/partners/partner-investment-spend-dialog";
import { PartnerInvestmentSpendRowActions } from "@/components/partners/partner-investment-spend-row-actions";
import { PartnerInvestmentsTabs } from "@/components/partners/partner-investments-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatPartnerInvestmentNumber,
  INVESTMENT_METHOD_LABELS,
} from "@/lib/partners/investment-constants";
import {
  listPartnerInvestmentBalances,
  listPartnerInvestments,
  listPartnerInvestmentSpends,
} from "@/actions/partners/investment-queries";
import {
  listPartnerOptions,
  listPartnerPendingAccruals,
} from "@/actions/partners/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function PartnerInvestmentsPage() {
  const { permission } = await requirePagePermission("partner-investments");
  const [investments, spends, balances, partners, accruals] =
    await Promise.all([
      listPartnerInvestments(),
      listPartnerInvestmentSpends(),
      listPartnerInvestmentBalances(),
      listPartnerOptions(),
      listPartnerPendingAccruals(),
    ]);

  const balanceList = partners.map((p) => ({
    partnerId: p.id,
    available: balances.get(p.id)?.available ?? 0,
  }));

  const investmentsTable = (
    <div className="rounded-md bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slip</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Funded by</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {investments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-muted-foreground"
              >
                No partner investments recorded yet.
              </TableCell>
            </TableRow>
          )}
          {investments.map((investment) => (
            <TableRow key={investment.id}>
              <TableCell className="font-medium">
                {formatPartnerInvestmentNumber(investment.number)}
              </TableCell>
              <TableCell>{investment.partner.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {INVESTMENT_METHOD_LABELS[investment.method]}
                {investment.method === "ONLINE" && investment.transactionId
                  ? ` (${investment.transactionId})`
                  : ""}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {investment.partnerPayment?.contract?.projectName ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(investment.date)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPkr(Number(investment.amount))}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <PartnerInvestmentRowActions
                    id={investment.id}
                    number={investment.number}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const spendingTable = (
    <div className="rounded-md bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Partner</TableHead>
            <TableHead>Spent on</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {spends.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-8 text-center text-muted-foreground"
              >
                No investment spending logged yet.
              </TableCell>
            </TableRow>
          )}
          {spends.map((spend) => (
            <TableRow key={spend.id}>
              <TableCell>{spend.partner.name}</TableCell>
              <TableCell className="font-medium">{spend.category}</TableCell>
              <TableCell className="text-muted-foreground">
                {spend.note ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(spend.date)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPkr(Number(spend.amount))}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <PartnerInvestmentSpendRowActions
                    id={spend.id}
                    category={spend.category}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Partner investments</h1>
        {permission.canCreate && (
          <div className="flex items-center gap-2">
            <PartnerInvestmentSpendDialog
              partners={partners}
              balances={balanceList}
            />
            <PartnerInvestmentDialog partners={partners} accruals={accruals} />
          </div>
        )}
      </div>

      <PartnerInvestmentsTabs
        investmentsTable={investmentsTable}
        spendingTable={spendingTable}
      />
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

function formatPkr(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}
