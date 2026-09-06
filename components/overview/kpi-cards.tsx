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
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCompactPkr, formatPkr } from "@/lib/finance/constants";
import { formatCompactContractAmount } from "@/lib/contracts/constants";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type { BucketAudit } from "@/actions/overview/queries";

function BudgetBadge({
  audit,
  variant = "spend",
}: {
  audit: BucketAudit;
  /** "spend" (Expenses/Investment): spending less than allocated is good.
   * "obligation" (Donation): it's a compulsory payable amount, so falling
   * short of it is the bad case, not the good one. */
  variant?: "spend" | "obligation";
}) {
  if (audit.overFraction === null) return null;
  const isOver = audit.overFraction > 0;
  const percent = Math.round(Math.abs(audit.overFraction) * 100);
  const isBad = variant === "obligation" ? !isOver : isOver;
  const Icon = isOver ? TrendingUpIcon : TrendingDownIcon;
  const label =
    variant === "obligation" && !isOver
      ? `${percent}% remains`
      : `${percent}% ${isOver ? "over" : "under"}`;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium " +
        (isBad
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")
      }
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function StatStrip({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1 py-1 sm:px-4 sm:py-0 sm:first:pl-0 sm:last:pr-0">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
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
  const pendingEntries = Object.entries(pendingByCurrency) as [
    PaymentCurrency,
    number,
  ][];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <BudgetBadge audit={donationAudit} variant="obligation" />
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatCompactPkr(totalDonations)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              vs {formatPkr(donationAudit.allocated)} allocated
            </p>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 divide-y divide-border sm:grid-cols-4 sm:gap-0 sm:divide-y-0 sm:divide-x">
          <StatStrip
            icon={UsersIcon}
            label="Team paid"
            value={formatCompactPkr(totalTeamPaid)}
            hint="This period, outside a booked earning"
          />
          <StatStrip
            icon={HourglassIcon}
            label="Pending payment for teams"
            value={formatCompactPkr(teamPendingPkr)}
            hint="Owed on unfinished outsourced work · all time"
          />
          <StatStrip
            icon={FileWarningIcon}
            label="Unpaid invoices"
            value={String(unpaidInvoiceCount)}
            hint="Awaiting payment · all time"
          />
          <StatStrip
            icon={HandCoinsIcon}
            label="Pending payments"
            value={formatCompactPkr(pendingTotalPkr)}
            hint={
              pendingEntries.length > 0
                ? pendingEntries
                    .map(([currency, amount]) =>
                      formatCompactContractAmount(amount, currency),
                    )
                    .join(" · ") + " · all time"
                : "All time"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
