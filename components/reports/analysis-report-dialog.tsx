"use client";

import * as React from "react";
import { FileTextIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_PRESETS, DATE_PRESET_LABELS, type DatePreset } from "@/lib/finance/date-range";
import type { AnalysisReportType } from "@/lib/reports/analysis/registry";

/** The last several fiscal years (July–June) that have already started,
 * newest first, as `{ startYear, label }` — e.g. `{ startYear: 2025, label:
 * "2025–26" }` for the year running Jul 2025 – Jun 2026. */
function recentFiscalYears(count: number): { startYear: number; label: string }[] {
  const now = new Date();
  const currentStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => {
    const startYear = currentStart - i;
    return { startYear, label: `${startYear}–${String(startYear + 1).slice(-2)}` };
  });
}

const FISCAL_YEARS = recentFiscalYears(6);

export function AnalysisReportDialog({
  type,
  title,
  description,
  periodKind,
}: {
  type: AnalysisReportType;
  title: string;
  description: string;
  periodKind: "range" | "fiscalYear";
}) {
  const [open, setOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<DatePreset>("this-year");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [fiscalYear, setFiscalYear] = React.useState(String(FISCAL_YEARS[0].startYear));

  function href() {
    const params = new URLSearchParams();
    if (periodKind === "fiscalYear") {
      params.set("fiscalYear", fiscalYear);
    } else {
      params.set("range", preset);
      if (preset === "custom") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
    }
    return `/api/reports/analysis/${type}?${params.toString()}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex flex-col gap-1.5 rounded-md bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
          />
        }
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <SparklesIcon className="size-4" />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate: {title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {periodKind === "fiscalYear" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Fiscal year</span>
              <Select
                value={fiscalYear}
                onValueChange={(value) => value && setFiscalYear(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_YEARS.map((fy) => (
                    <SelectItem key={fy.startYear} value={String(fy.startYear)}>
                      {fy.label} (1 Jul {fy.startYear} – 30 Jun {fy.startYear + 1})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">Date range</span>
                <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {DATE_PRESET_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {preset === "custom" && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    className="w-full"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="date"
                    className="w-full"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button render={<a href={href()} />} onClick={() => setOpen(false)}>
            <FileTextIcon />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
