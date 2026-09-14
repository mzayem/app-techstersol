"use client";

import * as React from "react";
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
import {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  type DatePreset,
} from "@/lib/finance/date-range";

export type PartnerOption = { id: string; name: string };

/** Export dialog for the partner earnings report — same date-range shape as
 * ExportReportDialog, plus a partner multi-select (defaults to every
 * partner; leaving it at "all" or clearing back to none both export every
 * partner, so there's no dead-end empty-report state). */
export function PartnerReportExportDialog({
  partners,
}: {
  partners: PartnerOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<DatePreset>("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set(partners.map((p) => p.id)),
  );

  const allSelected = selected.size === partners.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(partners.map((p) => p.id)));
  }

  function togglePartner(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function hrefFor(format: "xlsx" | "pdf") {
    const params = new URLSearchParams();
    params.set("range", preset);
    if (preset === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    // Every partner selected, or none — both mean "no filter, export all".
    if (selected.size > 0 && !allSelected) {
      params.set("partnerIds", [...selected].join(","));
    }
    params.set("format", format);
    return `/api/reports/partners?${params.toString()}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <DownloadIcon />
        Export report
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export partner earnings report</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Date range</span>
            <Select
              value={preset}
              onValueChange={(v) => setPreset(v as DatePreset)}
            >
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
            <DateRangePicker
              from={from}
              to={to}
              onChange={(range) => {
                setFrom(range.from);
                setTo(range.to);
              }}
            />
          )}

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Partners</span>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={toggleAll}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md p-2 ring-1 ring-foreground/10">
              {partners.length === 0 && (
                <p className="px-1 py-1 text-xs text-muted-foreground">
                  No partners yet.
                </p>
              )}
              {partners.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => togglePartner(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Leaving every partner checked (or clearing them all) exports every
            partner.
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
