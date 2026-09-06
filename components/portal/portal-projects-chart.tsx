"use client";

import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  completed: { label: "Completed", color: "#10b981" },
  pending: { label: "In progress", color: "#0ea5e9" },
} satisfies ChartConfig;

export function PortalProjectsChart({
  completed,
  pending,
}: {
  completed: number;
  pending: number;
}) {
  const data = (
    [
      { key: "completed" as const, value: completed },
      { key: "pending" as const, value: pending },
    ] as const
  ).filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your projects</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            No projects assigned yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square h-52">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="key"
                innerRadius={50}
                outerRadius={80}
                strokeWidth={2}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={chartConfig[d.key].color} />
                ))}
              </Pie>
              <ChartTooltip />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      <div className="flex justify-center gap-4 pb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-xs"
            style={{ backgroundColor: chartConfig.completed.color }}
          />
          Completed ({completed})
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-xs"
            style={{ backgroundColor: chartConfig.pending.color }}
          />
          In progress ({pending})
        </span>
      </div>
    </Card>
  );
}
