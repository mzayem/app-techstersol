"use client";

import { ImportDialog, type ImportColumn } from "@/components/finance/import-dialog";
import { createWorkDiaryEntry } from "@/actions/team/work-diary-actions";

const COLUMNS: ImportColumn[] = [
  { key: "teamMember", label: "Team member", required: true, hint: "Must match an existing team member's name" },
  { key: "week", label: "Week", required: true, hint: "Any date within the week — YYYY-MM-DD" },
  { key: "hours", label: "Hours", required: true, hint: "Total hours worked that week" },
  { key: "notes", label: "Notes", hint: "Optional — what they worked on" },
];

const SAMPLE_ROWS: Record<string, string>[] = [
  { teamMember: "Fiazan Mustafa", week: "2026-09-01", hours: "38", notes: "Landing page redesign" },
  { teamMember: "Fiazan Mustafa", week: "2026-09-08", hours: "40", notes: "Checkout flow QA" },
];

export function WorkDiaryImportDialog({
  teamMembers,
}: {
  teamMembers: { id: string; name: string }[];
}) {
  return (
    <ImportDialog
      title="Import work diary"
      description="Each row becomes one week's entry for the named team member — the amount is calculated automatically, same as adding one by hand."
      columns={COLUMNS}
      sampleRows={SAMPLE_ROWS}
      sampleFileName="work-diary-sample.csv"
      importRow={async (record) => {
        const member = teamMembers.find(
          (m) => m.name.toLowerCase() === record.teamMember.toLowerCase(),
        );
        if (!member) {
          throw new Error(`Unknown team member "${record.teamMember}"`);
        }
        const formData = new FormData();
        formData.set("teamMemberId", member.id);
        formData.set("week", record.week);
        formData.set("hours", record.hours);
        formData.set("notes", record.notes ?? "");
        await createWorkDiaryEntry(formData);
      }}
    />
  );
}
