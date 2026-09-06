"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  DownloadIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildSampleCsv, parseCsv } from "@/lib/csv/parse";

export type ImportColumn = {
  /** Exact CSV header this column matches (case-insensitive) — also the
   * field name passed through to `importRow`'s record. */
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
};

type RowError = { row: number; message: string };

export function ImportDialog({
  title,
  description,
  columns,
  sampleRows,
  sampleFileName,
  importRow,
}: {
  title: string;
  description: string;
  columns: ImportColumn[];
  sampleRows: Record<string, string>[];
  sampleFileName: string;
  /** Receives one parsed CSV row as { [column.key]: value }. Should throw
   * (or reject) with a user-facing message to fail just that row. */
  importRow: (row: Record<string, string>) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [result, setResult] = React.useState<{
    succeeded: number;
    errors: RowError[];
  } | null>(null);
  const [fileInputKey, setFileInputKey] = React.useState(0);

  function reset() {
    setFile(null);
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setFileInputKey((k) => k + 1);
  }

  function downloadSample() {
    const csv = buildSampleCsv(
      columns.map((c) => c.key),
      sampleRows,
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sampleFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setImporting(false);
      setResult({ succeeded: 0, errors: [{ row: 0, message: "The file is empty." }] });
      return;
    }

    const headerCells = rows[0].map((h) => h.trim());
    const columnByHeader = new Map(columns.map((c) => [c.key.toLowerCase(), c]));
    const indexToColumn = headerCells.map((h) => columnByHeader.get(h.toLowerCase()));

    const missingRequired = columns.filter(
      (c) => c.required && !headerCells.some((h) => h.toLowerCase() === c.key.toLowerCase()),
    );
    if (missingRequired.length > 0) {
      setImporting(false);
      setResult({
        succeeded: 0,
        errors: [
          {
            row: 0,
            message: `Missing required column(s): ${missingRequired
              .map((c) => c.key)
              .join(", ")}`,
          },
        ],
      });
      return;
    }

    const dataRows = rows.slice(1);
    setProgress({ done: 0, total: dataRows.length });

    let succeeded = 0;
    const errors: RowError[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i];
      const record: Record<string, string> = {};
      indexToColumn.forEach((col, idx) => {
        if (col) record[col.key] = (cells[idx] ?? "").trim();
      });

      const missingValue = columns.find((c) => c.required && !record[c.key]);
      if (missingValue) {
        errors.push({
          row: i + 2,
          message: `Missing required value for "${missingValue.key}"`,
        });
      } else {
        try {
          await importRow(record);
          succeeded++;
        } catch (e) {
          errors.push({
            row: i + 2,
            message: e instanceof Error ? e.message : "Something went wrong",
          });
        }
      }
      setProgress({ done: i + 1, total: dataRows.length });
    }

    setImporting(false);
    setResult({ succeeded, errors });
    if (succeeded > 0) router.refresh();
  }

  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (importing) return;
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <UploadIcon />
        Import
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          <div className="rounded-md ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Required</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((c) => (
                  <tr key={c.key} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium">{c.key}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {c.required ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {c.hint ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={downloadSample}>
            <DownloadIcon />
            Download sample CSV
          </Button>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">CSV file</span>
            <Input
              key={fileInputKey}
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={(e) => {
                setResult(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
          </label>

          {importing && (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Importing {progress.done} of {progress.total} rows…
              </span>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 text-sm">
              <div className="flex items-center gap-1.5">
                {result.errors.length === 0 ? (
                  <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircleIcon className="size-4 text-destructive" />
                )}
                <span className="font-medium">
                  {result.succeeded} row{result.succeeded === 1 ? "" : "s"} imported
                  {result.errors.length > 0
                    ? `, ${result.errors.length} failed`
                    : ""}
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="flex max-h-32 flex-col gap-0.5 overflow-y-auto text-xs text-destructive">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>
                      {err.row > 0 ? `Row ${err.row}: ` : ""}
                      {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Close
          </Button>
          <Button type="button" disabled={!file || importing} onClick={handleImport}>
            {importing ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
