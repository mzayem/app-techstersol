import {
  FileWarningIcon,
  HandCoinsIcon,
  PiggyBankIcon,
  ReceiptIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  GiftIcon,
  UsersIcon,
  HourglassIcon,
} from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactPkr, formatPkr } from "@/lib/finance/constants";
import { formatCompactContractAmount } from "@/lib/contracts/constants";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type { BucketAudit } from "@/actions/overview/queries";

function BudgetBadge({ audit }: { audit: BucketAudit }) {
  if (audit.overFraction === null) return null;
  const isOver = audit.overFraction > 0;
  const percent = Math.round(Math.abs(audit.overFraction) * 100);
  const Icon = isOver ? TrendingUpIcon : TrendingDownIcon;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium " +
        (isOver
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")
      }
    >
      <Icon className="size-3" />
      {percent}% {isOver ? "over" : "under"}
    </span>
  );
}

export function KpiCards({
  periodEarning,
  avgMonthlyEarning,
  totalExpenses,
  totalDonations,
  totalInvestment,
  totalTeamPaid,
  expensesAudit,
  investmentAudit,
  donationAudit,
  unpaidInvoiceCount,
  pendingByCurrency,
  pendingTotalPkr,
  teamPendingPkr,
}: {
  periodEarning: number;
  avgMonthlyEarning: number;
  totalExpenses: number;
  totalDonations: number;
  totalInvestment: number;
  totalTeamPaid: number;
  expensesAudit: BucketAudit;
  investmentAudit: BucketAudit;
  donationAudit: BucketAudit;
  unpaidInvoiceCount: number;
  pendingByCurrency: Partial<Record<PaymentCurrency, number>>;
  pendingTotalPkr: number;
  teamPendingPkr: number;
}) {
  const pendingEntries = Object.entries(pendingByCurrency) as [PaymentCurrency, number][];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUpIcon className="size-4" />
            <CardDescription>Earning</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(periodEarning)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Avg {formatPkr(avgMonthlyEarning)}/mo for this period
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ReceiptIcon className="size-4" />
              <CardDescription>Total expenses</CardDescription>
            </div>
            <BudgetBadge audit={expensesAudit} />
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(totalExpenses)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            vs {formatPkr(expensesAudit.allocated)} allocated
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <PiggyBankIcon className="size-4" />
              <CardDescription>Total investment</CardDescription>
            </div>
            <BudgetBadge audit={investmentAudit} />
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(totalInvestment)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            vs {formatPkr(investmentAudit.allocated)} allocated
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <GiftIcon className="size-4" />
              <CardDescription>Total donations</CardDescription>
            </div>
            <BudgetBadge audit={donationAudit} />
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(totalDonations)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            vs {formatPkr(donationAudit.allocated)} allocated
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <UsersIcon className="size-4" />
            <CardDescription>Team paid</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(totalTeamPaid)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">This period, outside a booked earning</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HourglassIcon className="size-4" />
            <CardDescription>Pending payment for teams</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(teamPendingPkr)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Owed on unfinished outsourced work · all time</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileWarningIcon className="size-4" />
            <CardDescription>Unpaid invoices</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {unpaidInvoiceCount}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Awaiting payment · all time</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HandCoinsIcon className="size-4" />
            <CardDescription>Pending payments</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(pendingTotalPkr)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {pendingEntries.length > 0
              ? pendingEntries
                  .map(([currency, amount]) => formatCompactContractAmount(amount, currency))
                  .join(" · ") + " · all time"
              : "All time"}
          </p>
        </CardHeader>
      </Card>
    </div>
  );
}
