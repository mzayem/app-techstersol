"use client";

import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatPkr } from "@/lib/finance/constants";
import type { PartnerClientRevenue } from "@/actions/partner-portal/queries";

const PALETTE = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899", "#64748b"];

/** Same donut shape as components/portal/portal-projects-chart.tsx, but fed
 * a dynamic per-client breakdown instead of a fixed completed/pending pair
 * — revenue (converted to a comparable PKR estimate) for every client this
 * partner brought in (Client.broughtByPartnerId). A rough breakdown, not
 * an accounting figure — see getPartnerOverview's revenueByClient. */
export function PartnerClientRevenueChart({ data }: { data: PartnerClientRevenue[] }) {
  const top = data.slice(0, PALETTE.length);
  const chartConfig = Object.fromEntries(
    top.map((d, i) => [d.clientId, { label: d.clientName, color: PALETTE[i % PALETTE.length] }]),
  ) satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by client you brought in</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            No revenue from your clients yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square h-52">
            <PieChart>
              <Pie
                data={top}
                dataKey="amountPkr"
                nameKey="clientId"
                innerRadius={50}
                outerRadius={80}
                strokeWidth={2}
              >
                {top.map((d, i) => (
                  <Cell key={d.clientId} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <ChartTooltip />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      {top.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pb-4 text-xs text-muted-foreground">
          {top.map((d, i) => (
            <span key={d.clientId} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-xs"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              {d.clientName} ({formatPkr(d.amountPkr)})
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
