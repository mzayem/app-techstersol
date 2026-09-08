import type { ReactNode } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

/** Dot colors for the Expenses breakdown rows, matching the series colors
 * on the Overview area chart (components/overview/finance-area-chart.tsx)
 * so the same bucket reads as the same color everywhere. */
const BREAKDOWN_DOT_COLORS: Record<string, string> = {
  Expenses: "#f43f5e",
  Lifestyle: "#8b5cf6",
  "Emergency fund": "#f59e0b",
};

/** One row of the chart-style tooltip card: an optional color dot, a muted
 * label, and a right-aligned mono value — mirrors ChartTooltipContent's
 * row markup (components/ui/chart.tsx) so every tooltip in the app reads
 * the same way. */
function TooltipRow({
  color,
  label,
  value,
  emphasis,
}: {
  color?: string;
  label: string;
  value: string;
  emphasis?: "bad";
}) {
  return (
    <div className="flex w-full items-center gap-2">
      {color && (
        <span
          className="size-2.5 shrink-0 rounded-xs"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono font-medium tabular-nums text-foreground",
          emphasis === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function KpiTooltipCard({ children }: { children: ReactNode }) {
  return (
    <TooltipContent
      side="bottom"
      className="w-56 flex-col items-stretch gap-1.5 rounded-lg px-2.5 py-2"
    >
      {children}
    </TooltipContent>
  );
}

function StatStrip({
  icon: Icon,
  label,
  value,
  full,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Exact figure shown on hover when `value` is abbreviated (M/K). */
  full?: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1 py-1 sm:px-4 sm:py-0 sm:first:pl-0 sm:last:pr-0">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      {full ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="w-fit cursor-help text-lg font-semibold tabular-nums" />
            }
          >
            {value}
          </TooltipTrigger>
          <TooltipContent side="bottom">{full}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      )}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

/** The plain "Earning" card has no allocation to compare against — just
 * shows the exact figure on hover, since the card itself is abbreviated
 * ("Rs 2.4M") for scannability. */
function SimpleKpiValue({ compact, full }: { compact: string; full: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <CardTitle className="w-fit cursor-help text-2xl font-semibold tabular-nums" />
        }
      >
        {compact}
      </TooltipTrigger>
      <TooltipContent side="bottom">{full}</TooltipContent>
    </Tooltip>
  );
}

/** Expenses/Investment/Donation cards: hovering the abbreviated figure
 * shows the exact amount, the sub-buckets it's made of (Expenses only —
 * "Total expenses" is really Expense + Lifestyle + Emergency fund), and
 * how much of the allocated share is left. */
function AuditKpiValue({
  compact,
  audit,
  variant = "spend",
}: {
  compact: string;
  audit: BucketAudit;
  variant?: "spend" | "obligation";
}) {
  const remaining = audit.allocated - audit.spent;
  // "spend" buckets: money left unspent is the good case. "obligation"
  // (Donation): still owing money is the bad case, same as BudgetBadge.
  const remainingIsBad =
    variant === "obligation" ? remaining > 0 : remaining < 0;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <CardTitle className="w-fit cursor-help text-2xl font-semibold tabular-nums" />
        }
      >
        {compact}
      </TooltipTrigger>
      <KpiTooltipCard>
        <TooltipRow label="Total" value={formatPkr(audit.spent)} />
        {audit.breakdown && (
          <div className="flex flex-col gap-1 border-t border-border/60 pt-1.5">
            {audit.breakdown.map((b) => (
              <TooltipRow
                key={b.label}
                color={BREAKDOWN_DOT_COLORS[b.label]}
                label={b.label}
                value={formatPkr(b.value)}
              />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1 border-t border-border/60 pt-1.5">
          <TooltipRow label="Allocated" value={formatPkr(audit.allocated)} />
          <TooltipRow
            label={remaining >= 0 ? "Remaining" : "Over by"}
            value={formatPkr(Math.abs(remaining))}
            emphasis={remainingIsBad ? "bad" : undefined}
          />
        </div>
      </KpiTooltipCard>
    </Tooltip>
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
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUpIcon className="size-4" />
                <CardDescription>Earning</CardDescription>
              </div>
              <SimpleKpiValue
                compact={formatCompactPkr(periodEarning)}
                full={formatPkr(periodEarning)}
              />
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
              <AuditKpiValue
                compact={formatCompactPkr(totalExpenses)}
                audit={expensesAudit}
              />
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
              <AuditKpiValue
                compact={formatCompactPkr(totalInvestment)}
                audit={investmentAudit}
              />
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
              <AuditKpiValue
                compact={formatCompactPkr(totalDonations)}
                audit={donationAudit}
                variant="obligation"
              />
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
              full={formatPkr(totalTeamPaid)}
              hint="Outside a booked earning"
            />
            <StatStrip
              icon={HourglassIcon}
              label="Pending payment for teams"
              value={formatCompactPkr(teamPendingPkr)}
              full={formatPkr(teamPendingPkr)}
              hint="Projects + logged diary hours · all time"
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
              full={formatPkr(pendingTotalPkr)}
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
    </TooltipProvider>
  );
}
