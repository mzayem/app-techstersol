"use client";

import { ImportDialog, type ImportColumn } from "@/components/finance/import-dialog";
import { createExpense } from "@/actions/finance/actions";

const COLUMNS: ImportColumn[] = [
  { key: "date", label: "Date", required: true, hint: "YYYY-MM-DD" },
  {
    key: "category",
    label: "Category",
    required: true,
    hint: "EXPENSE, LIFESTYLE, INVESTMENT, or EMERGENCY_FUND",
  },
  { key: "name", label: "Name", required: true, hint: "What it was for" },
  { key: "amount", label: "Amount", required: true, hint: "In PKR" },
];

const SAMPLE_ROWS: Record<string, string>[] = [
  { date: "2026-01-10", category: "EXPENSE", name: "Office internet", amount: "4500" },
  { date: "2026-01-20", category: "INVESTMENT", name: "Index fund top-up", amount: "20000" },
];

export function ExpenseImportDialog() {
  return (
    <ImportDialog
      title="Import expenses"
      description="Each row becomes one expense entry against the given category — same as adding one by hand."
      columns={COLUMNS}
      sampleRows={SAMPLE_ROWS}
      sampleFileName="expenses-sample.csv"
      importRow={async (record) => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(record)) {
          formData.set(key, value);
        }
        await createExpense(formData);
      }}
    />
  );
}
