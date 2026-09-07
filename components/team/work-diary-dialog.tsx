"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { formatPkr } from "@/lib/finance/constants";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type { TeamMemberType } from "@/lib/team/constants";
import { mondayOf } from "@/lib/team/work-diary";
import {
  createWorkDiaryEntry,
  deleteWorkDiaryEntry,
  updateWorkDiaryEntry,
} from "@/actions/team/work-diary-actions";
import { TeamActionsMenu } from "@/components/team/team-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";
import { WeekPicker } from "@/components/team/week-picker";

export type TeamMemberOption = {
  id: string;
  name: string;
  type: TeamMemberType;
  hourlyRate: number | null;
  currency: PaymentCurrency;
};

export type WorkDiaryEntry = {
  id: string;
  teamMemberId: string;
  teamMemberName: string;
  weekStart: Date;
  hours: number;
  amount: number | null;
  notes: string | null;
};

export function WorkDiaryDialog({
  teamMembers,
  ratesToPkr,
  entry,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  locked = false,
  onUnlock,
}: {
  teamMembers: TeamMemberOption[];
  ratesToPkr: Record<PaymentCurrency, number>;
  entry?: WorkDiaryEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
}) {
  const isEdit = !!entry;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [teamMemberId, setTeamMemberId] = React.useState(entry?.teamMemberId ?? "");
  const [hoursInput, setHoursInput] = React.useState(entry?.hours.toString() ?? "");
  const [weekStart, setWeekStart] = React.useState(
    entry?.weekStart ?? mondayOf(new Date()),
  );

  const selectedMember = teamMembers.find((m) => m.id === teamMemberId);
  const previewHours = Number(hoursInput);
  const previewAmount =
    selectedMember?.type === "HOURLY" &&
    selectedMember.hourlyRate &&
    previewHours > 0
      ? previewHours *
        selectedMember.hourlyRate *
        (ratesToPkr[selectedMember.currency] ?? 1)
      : null;

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateWorkDiaryEntry(entry.id, formData);
        } else {
          await createWorkDiaryEntry(formData);
          formRef.current?.reset();
          setTeamMemberId("");
          setHoursInput("");
          setWeekStart(mondayOf(new Date()));
        }
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Add entry
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit work diary entry" : "Add work diary entry"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Team member">
            <Combobox
              value={teamMemberId}
              onValueChange={setTeamMemberId}
              options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
              placeholder="Select team member"
              searchPlaceholder="Search team…"
              emptyText="No team members found."
              disabled={locked}
            />
            <input type="hidden" name="teamMemberId" value={teamMemberId} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Week">
              <WeekPicker value={weekStart} onChange={setWeekStart} disabled={locked} />
              <input type="hidden" name="week" value={toDateInputValue(weekStart)} />
            </Field>
            <Field label="Hours">
              <Input
                type="number"
                name="hours"
                min="0.25"
                step="0.25"
                placeholder="0"
                required
                disabled={locked}
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
              />
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedMember?.type === "HOURLY"
              ? previewAmount !== null
                ? `Amount: ${formatPkr(previewAmount)} (${previewHours} hrs × ${selectedMember.hourlyRate} ${selectedMember.currency}/hr)`
                : "Enter hours to preview the amount"
              : selectedMember
                ? "Project-based member — no hourly rate, so no amount is calculated"
                : "Select a team member to preview the amount"}
          </p>

          <Field label="Notes (optional)">
            <Textarea
              name="notes"
              placeholder="What did they work on this week?"
              rows={2}
              disabled={locked}
              defaultValue={entry?.notes ?? undefined}
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            {locked ? (
              <Button
                key="update"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onUnlock?.();
                }}
              >
                Update
              </Button>
            ) : (
              <Button key="save" type="submit" disabled={!teamMemberId} loading={pending}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Save entry"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WorkDiaryRowActions({
  entry,
  teamMembers,
  ratesToPkr,
  children,
}: {
  entry: WorkDiaryEntry;
  teamMembers: TeamMemberOption[];
  ratesToPkr: Record<PaymentCurrency, number>;
  children: React.ReactNode;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [locked, setLocked] = React.useState(true);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  function openView() {
    setLocked(true);
    setDialogOpen(true);
  }

  function openEdit() {
    setLocked(false);
    setDialogOpen(true);
  }

  return (
    <>
      <TableRow className="cursor-pointer" onClick={openView}>
        {children}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end">
            <TeamActionsMenu onEdit={openEdit} onDelete={() => setDeleteOpen(true)} />
          </div>
        </TableCell>
      </TableRow>
      <WorkDiaryDialog
        teamMembers={teamMembers}
        ratesToPkr={ratesToPkr}
        entry={entry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locked={locked}
        onUnlock={() => setLocked(false)}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`${entry.teamMemberName}'s work diary entry`}
        onDelete={deleteWorkDiaryEntry.bind(null, entry.id)}
      />
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
