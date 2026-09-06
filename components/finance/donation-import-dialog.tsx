"use client";

import { ImportDialog, type ImportColumn } from "@/components/finance/import-dialog";
import { createDonation } from "@/actions/finance/actions";

const COLUMNS: ImportColumn[] = [
  { key: "date", label: "Date", required: true, hint: "YYYY-MM-DD" },
  { key: "name", label: "Name", required: true, hint: "Recipient" },
  { key: "amount", label: "Amount", required: true, hint: "In PKR" },
];

const SAMPLE_ROWS: Record<string, string>[] = [
  { date: "2026-01-05", name: "Local mosque", amount: "300" },
  { date: "2026-02-14", name: "Edhi Foundation", amount: "1500" },
];

export function DonationImportDialog() {
  return (
    <ImportDialog
      title="Import donations"
      description="Each row becomes one donation entry — same as adding one by hand."
      columns={COLUMNS}
      sampleRows={SAMPLE_ROWS}
      sampleFileName="donations-sample.csv"
      importRow={async (record) => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(record)) {
          formData.set(key, value);
        }
        await createDonation(formData);
      }}
    />
  );
}
