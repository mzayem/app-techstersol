"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";

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

/** Export dialog for list pages with no date filter of their own (Clients,
 * Contracts, Invoices, Payslips) — picks a range here rather than reading
 * one off the page, then exports via the same `/api/reports/[module]`
 * route as everywhere else, still respecting whatever search/status filter
 * is currently applied on the page itself. */
export function ExportReportDialog({
  module,
  label,
}: {
  module: string;
  /** Used in the dialog title, e.g. "contracts" → "Export contracts report". */
  label: string;
}) {
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<DatePreset>("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  function hrefFor(format: "xlsx" | "pdf") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    if (preset === "custom") {
      if (from) params.set("from", from);
      else params.delete("from");
      if (to) params.set("to", to);
      else params.delete("to");
    } else {
      params.delete("from");
      params.delete("to");
    }
    params.set("format", format);
    return `/api/reports/${module}?${params.toString()}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <DownloadIcon />
        Export report
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export {label} report</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
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

          <p className="text-xs text-muted-foreground">
            Exports whatever search or status filter is currently applied on
            the page, for the range chosen here.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setOpen(false)}
            render={<a href={hrefFor("xlsx")} />}
          >
            <FileSpreadsheetIcon />
            Excel (.xlsx)
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setOpen(false)}
            render={<a href={hrefFor("pdf")} />}
          >
            <FileTextIcon />
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
