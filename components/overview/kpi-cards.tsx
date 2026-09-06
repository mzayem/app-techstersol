import {
  FileWarningIcon,
  HandCoinsIcon,
  PiggyBankIcon,
  ReceiptIcon,
  TrendingUpIcon,
  GiftIcon,
} from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactPkr, formatPkr } from "@/lib/finance/constants";
import { formatCompactContractAmount } from "@/lib/contracts/constants";
import type { PaymentCurrency } from "@/lib/clients/constants";

export function KpiCards({
  currentMonthEarning,
  avgMonthlyEarning,
  totalEarning,
  totalExpenses,
  totalDonations,
  totalInvestment,
  unpaidInvoiceCount,
  pendingByCurrency,
  pendingTotalPkr,
}: {
  currentMonthEarning: number;
  avgMonthlyEarning: number;
  totalEarning: number;
  totalExpenses: number;
  totalDonations: number;
  totalInvestment: number;
  unpaidInvoiceCount: number;
  pendingByCurrency: Partial<Record<PaymentCurrency, number>>;
  pendingTotalPkr: number;
}) {
  const pendingEntries = Object.entries(pendingByCurrency) as [PaymentCurrency, number][];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUpIcon className="size-4" />
            <CardDescription>Monthly earning</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(currentMonthEarning)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            This year: avg {formatPkr(avgMonthlyEarning)}/mo · total {formatPkr(totalEarning)}
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ReceiptIcon className="size-4" />
            <CardDescription>Total expenses</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(totalExpenses)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">All-time, every bucket</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <PiggyBankIcon className="size-4" />
            <CardDescription>Total investment</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(totalInvestment)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">All-time</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GiftIcon className="size-4" />
            <CardDescription>Total donations</CardDescription>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCompactPkr(totalDonations)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">All-time</p>
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
          <p className="text-xs text-muted-foreground">Awaiting payment</p>
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
          {pendingEntries.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {pendingEntries
                .map(([currency, amount]) => formatCompactContractAmount(amount, currency))
                .join(" · ")}{" "}
              converted at the current FX rate
            </p>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}
