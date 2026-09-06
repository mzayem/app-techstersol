"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPkr } from "@/lib/finance/constants";
import type { MonthlyPoint } from "@/actions/overview/queries";

const RANGE_OPTIONS = [
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "tax-year", label: "This tax year" },
  { value: "this-year", label: "This year" },
  { value: "custom", label: "Custom" },
] as const;
type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];

const chartConfig = {
  earning: { label: "Earning", color: "#10b981" },
  expense: { label: "Expenses", color: "#f43f5e" },
  lifestyle: { label: "Lifestyle", color: "#8b5cf6" },
  investment: { label: "Investment", color: "#0ea5e9" },
  emergencyFund: { label: "Emergency fund", color: "#f59e0b" },
  donation: { label: "Donation", color: "#ec4899" },
} satisfies ChartConfig;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Techstersol's tax year runs 1 July – 30 June (Pakistan's fiscal year). */
function taxYearStart(now: Date) {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 6, 1);
}

function rangeStart(range: RangeValue, customFrom: string, now: Date) {
  switch (range) {
    case "3m":
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case "6m":
      return new Date(now.getFullYear(), now.getMonth() - 5, 1);
    case "tax-year":
      return taxYearStart(now);
    case "this-year":
      return new Date(now.getFullYear(), 0, 1);
    case "custom":
      return customFrom ? new Date(customFrom) : new Date(0);
  }
}

export function FinanceAreaChart({
  series,
  initialRange = "6m",
  initialFrom,
  initialTo,
}: {
  series: MonthlyPoint[];
  initialRange?: RangeValue;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [range, setRange] = React.useState<RangeValue>(initialRange);
  const [customFrom, setCustomFrom] = React.useState(() => {
    if (initialFrom) return initialFrom;
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = React.useState(
    () => initialTo ?? new Date().toISOString().slice(0, 10),
  );

  const filtered = React.useMemo(() => {
    const from = monthKey(rangeStart(range, customFrom, new Date()));
    const to = range === "custom" ? monthKey(new Date(customTo)) : monthKey(new Date());
    return series.filter((p) => p.month >= from && p.month <= to);
  }, [series, range, customFrom, customTo]);

  const totals = React.useMemo(
    () =>
      filtered.reduce(
        (acc, p) => ({
          earning: acc.earning + p.earning,
          spent:
            acc.spent + p.expense + p.lifestyle + p.investment + p.emergencyFund + p.donation,
        }),
        { earning: 0, spent: 0 },
      ),
    [filtered],
  );

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Finance overview</CardTitle>
        <CardDescription>
          Earning {formatPkr(totals.earning)} · Spent {formatPkr(totals.spent)} · Net{" "}
          {formatPkr(totals.earning - totals.spent)}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          {range === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 w-36"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 w-36"
              />
            </div>
          )}
          <Select value={range} onValueChange={(v) => v && setRange(v as RangeValue)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filtered.length === 0 ? (
          <div className="flex h-75 items-center justify-center text-sm text-muted-foreground">
            No activity recorded in this range yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-75 w-full">
            <AreaChart data={filtered}>
              <defs>
                {Object.entries(chartConfig).map(([key, cfg]) => (
                  <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cfg.color} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={cfg.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    year: "2-digit",
                  })
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="earning"
                type="monotone"
                fill="url(#fill-earning)"
                stroke={chartConfig.earning.color}
              />
              <Area
                dataKey="expense"
                type="monotone"
                stackId="spend"
                fill="url(#fill-expense)"
                stroke={chartConfig.expense.color}
              />
              <Area
                dataKey="lifestyle"
                type="monotone"
                stackId="spend"
                fill="url(#fill-lifestyle)"
                stroke={chartConfig.lifestyle.color}
              />
              <Area
                dataKey="investment"
                type="monotone"
                stackId="spend"
                fill="url(#fill-investment)"
                stroke={chartConfig.investment.color}
              />
              <Area
                dataKey="emergencyFund"
                type="monotone"
                stackId="spend"
                fill="url(#fill-emergencyFund)"
                stroke={chartConfig.emergencyFund.color}
              />
              <Area
                dataKey="donation"
                type="monotone"
                stackId="spend"
                fill="url(#fill-donation)"
                stroke={chartConfig.donation.color}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
