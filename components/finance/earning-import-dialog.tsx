"use client";

import { ImportDialog, type ImportColumn } from "@/components/finance/import-dialog";
import { createEarning } from "@/actions/finance/actions";

const COLUMNS: ImportColumn[] = [
  { key: "date", label: "Date", required: true, hint: "YYYY-MM-DD" },
  { key: "name", label: "Name", required: true, hint: "Client or project" },
  { key: "amount", label: "Amount", required: true, hint: "In PKR" },
  { key: "teamPay", label: "Team pay", hint: "In PKR — defaults to 0" },
  {
    key: "referenceAmount",
    label: "Reference amount",
    hint: "Optional — original foreign-currency amount",
  },
  {
    key: "referenceCurrency",
    label: "Reference currency",
    hint: "Optional — PKR, USD, GBP, EUR, AUD, or AED",
  },
];

const SAMPLE_ROWS: Record<string, string>[] = [
  {
    date: "2026-01-15",
    name: "Acme Corp — Invoice #1001",
    amount: "50000",
    teamPay: "0",
    referenceAmount: "",
    referenceCurrency: "",
  },
  {
    date: "2026-02-03",
    name: "Beta LLC — Milestone 2",
    amount: "120000",
    teamPay: "30000",
    referenceAmount: "430",
    referenceCurrency: "USD",
  },
];

export function EarningImportDialog() {
  return (
    <ImportDialog
      title="Import earnings"
      description="Each row becomes one earning entry, split into distribution buckets automatically — same as adding one by hand."
      columns={COLUMNS}
      sampleRows={SAMPLE_ROWS}
      sampleFileName="earnings-sample.csv"
      importRow={async (record) => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(record)) {
          formData.set(key, value);
        }
        await createEarning(formData);
      }}
    />
  );
}
