"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPkr } from "@/lib/finance/constants";
import type { PartnerMonthlyPoint } from "@/actions/partner-portal/queries";

const chartConfig = {
  amount: { label: "Earnings", color: "#10b981" },
} satisfies ChartConfig;

/** A single-series adaptation of components/overview/finance-area-chart.tsx
 * — just this partner's own PartnerPayment activity, last 12 months, with
 * no range picker since there's only ever one series to show. */
export function PartnerEarningsChart({ series }: { series: PartnerMonthlyPoint[] }) {
  const total = series.reduce((sum, p) => sum + p.amount, 0);
  const hasActivity = series.some((p) => p.amount > 0);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Your earnings</CardTitle>
        <CardDescription>Last 12 months · Total {formatPkr(total)}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {!hasActivity ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No payments recorded in this range yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="fill-partner-amount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartConfig.amount.color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={chartConfig.amount.color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) =>
                  new Date(value).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="amount"
                type="monotone"
                fill="url(#fill-partner-amount)"
                stroke={chartConfig.amount.color}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
