"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPkr } from "@/lib/finance/constants";
import { formatWeekRange } from "@/lib/team/work-diary";
import { createPayslip } from "@/actions/team/payslip-actions";

export type TeamMemberOption = { id: string; name: string };
export type ContractOption = { id: string; projectName: string; teamMemberId: string | null };
export type WorkDiaryOption = {
  id: string;
  teamMemberId: string;
  weekStart: Date;
  weekEnd: Date;
  hours: number;
  amount: number | null;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function PayslipDialog({
  teamMembers,
  contracts,
  workDiaryEntries,
}: {
  teamMembers: TeamMemberOption[];
  contracts: ContractOption[];
  workDiaryEntries: WorkDiaryOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [teamMemberId, setTeamMemberId] = React.useState("");
  const [contractId, setContractId] = React.useState("");
  const [fromDiary, setFromDiary] = React.useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = React.useState<string[]>([]);
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState(todayInput());
  const [amount, setAmount] = React.useState("");

  const projectOptions = contracts.filter((c) => c.teamMemberId === teamMemberId);
  const memberDiaryEntries = workDiaryEntries
    .filter((e) => e.teamMemberId === teamMemberId)
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());

  /** Fills period/amount from whichever diary weeks are checked — called
   * directly from the checkbox handler (a real user action), not a
   * derived-state effect, so a manual edit afterward isn't clobbered. */
  function applySelection(ids: string[]) {
    const entries = memberDiaryEntries.filter((e) => ids.includes(e.id));
    if (entries.length === 0) return;
    const starts = entries.map((e) => e.weekStart.getTime());
    const ends = entries.map((e) => e.weekEnd.getTime());
    setPeriodStart(toDateInputValue(new Date(Math.min(...starts))));
    setPeriodEnd(toDateInputValue(new Date(Math.max(...ends))));
    const total = entries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
    setAmount(total ? String(total) : "");
  }

  function toggleEntry(id: string) {
    setSelectedEntryIds((ids) => {
      const next = ids.includes(id)
        ? ids.filter((x) => x !== id)
        : [...ids, id];
      applySelection(next);
      return next;
    });
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createPayslip(formData);
        formRef.current?.reset();
        setTeamMemberId("");
        setContractId("");
        setFromDiary(false);
        setSelectedEntryIds([]);
        setPeriodStart("");
        setPeriodEnd(todayInput());
        setAmount("");
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Add payslip
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add payslip</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Team member">
            <Combobox
              value={teamMemberId}
              onValueChange={(v) => {
                setTeamMemberId(v);
                setContractId("");
                setSelectedEntryIds([]);
              }}
              options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
              placeholder="Select team member"
              searchPlaceholder="Search team…"
              emptyText="No team members found."
            />
            <input type="hidden" name="teamMemberId" value={teamMemberId} />
          </Field>

          {teamMemberId && (
            <Field label="Assigned project (optional)">
              <Combobox
                value={contractId}
                onValueChange={setContractId}
                options={projectOptions.map((c) => ({ value: c.id, label: c.projectName }))}
                placeholder="No specific project"
                searchPlaceholder="Search projects…"
                emptyText="This team member has no assigned projects."
              />
              <input type="hidden" name="contractId" value={contractId} />
            </Field>
          )}

          {teamMemberId && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={fromDiary}
                  onCheckedChange={(checked) => setFromDiary(!!checked)}
                />
                Generate from work diary
              </label>
              {fromDiary && (
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md p-2 ring-1 ring-foreground/10">
                  {memberDiaryEntries.length === 0 && (
                    <p className="p-1 text-xs text-muted-foreground">
                      No work diary entries logged for this member yet.
                    </p>
                  )}
                  {memberDiaryEntries.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 py-0.5 text-sm"
                    >
                      <Checkbox
                        checked={selectedEntryIds.includes(e.id)}
                        onCheckedChange={() => toggleEntry(e.id)}
                      />
                      <span className="flex-1 text-muted-foreground">
                        {formatWeekRange(e.weekStart, e.weekEnd)} · {e.hours} hrs
                      </span>
                      <span className="tabular-nums">
                        {e.amount !== null ? formatPkr(e.amount) : "—"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start">
              <Input
                type="date"
                name="periodStart"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </Field>
            <Field label="Period end">
              <Input
                type="date"
                name="periodEnd"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date">
              <Input type="date" name="issueDate" required defaultValue={todayInput()} />
            </Field>
            <Field label="Amount (PKR)">
              <Input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Note (optional)">
            <Textarea name="note" placeholder="Optional" rows={2} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!teamMemberId} loading={pending}>
              {pending ? "Saving…" : "Save payslip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
