"use client";

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatPkr } from "@/lib/finance/constants";
import type { ClientRevenueSlice } from "@/actions/overview/queries";

const COLORS = [
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#f43f5e",
  "#14b8a6",
  "#6366f1",
];

/** The "Other" slice (earnings with no client invoice behind them) always
 * gets this neutral gray rather than a color from the client palette, so it
 * reads as a catch-all bucket rather than another client. */
const OTHER_COLOR = "#94a3b8";

function colorFor(client: ClientRevenueSlice, clientIndex: number) {
  return client.isOther ? OTHER_COLOR : COLORS[clientIndex % COLORS.length];
}

export function RevenuePieChart({ clients }: { clients: ClientRevenueSlice[] }) {
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    let clientIndex = 0;
    clients.forEach((c) => {
      config[c.clientId] = {
        label: c.clientName,
        color: colorFor(c, c.isOther ? 0 : clientIndex++),
      };
    });
    return config;
  }, [clients]);

  const total = clients.reduce((sum, c) => sum + c.revenue, 0);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Revenue by client</CardTitle>
        <CardDescription>
          {clients.length === 0
            ? "No paid invoices yet"
            : `${formatPkr(total)} across ${clients.length} client${clients.length === 1 ? "" : "s"}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="flex h-62.5 items-center justify-center text-sm text-muted-foreground">
            Revenue appears here once an invoice is marked paid.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square h-70">
            <PieChart>
              <Pie
                data={clients}
                dataKey="revenue"
                nameKey="clientId"
                innerRadius={60}
                outerRadius={100}
                strokeWidth={2}
              >
                {clients.map((c) => (
                  <Cell key={c.clientId} fill={chartConfig[c.clientId]?.color} />
                ))}
              </Pie>
              <ChartTooltip content={<RevenueTooltip />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      {clients.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-(--card-spacing) text-xs sm:grid-cols-3">
          {clients.map((c) => (
            <div key={c.clientId} className="flex items-center gap-1.5 truncate">
              <span
                className="size-2 shrink-0 rounded-xs"
                style={{ backgroundColor: chartConfig[c.clientId]?.color }}
              />
              <span className="truncate text-muted-foreground">{c.clientName}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ClientRevenueSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="grid gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="font-medium">{slice.clientName}</span>
      <span className="text-muted-foreground">
        {formatPkr(slice.revenue)}
        {!slice.isOther &&
          ` · ${slice.projectCount} project${slice.projectCount === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}
