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
import { createPayslip } from "@/actions/team/payslip-actions";

export type TeamMemberOption = { id: string; name: string };
export type ContractOption = { id: string; projectName: string; teamMemberId: string | null };

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function PayslipDialog({
  teamMembers,
  contracts,
}: {
  teamMembers: TeamMemberOption[];
  contracts: ContractOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [teamMemberId, setTeamMemberId] = React.useState("");
  const [contractId, setContractId] = React.useState("");

  const projectOptions = contracts.filter((c) => c.teamMemberId === teamMemberId);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createPayslip(formData);
        formRef.current?.reset();
        setTeamMemberId("");
        setContractId("");
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start">
              <Input type="date" name="periodStart" required />
            </Field>
            <Field label="Period end">
              <Input type="date" name="periodEnd" required defaultValue={todayInput()} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date">
              <Input type="date" name="issueDate" required defaultValue={todayInput()} />
            </Field>
            <Field label="Amount (PKR)">
              <Input type="number" name="amount" min="0" step="0.01" placeholder="0.00" required />
            </Field>
          </div>

          <Field label="Note (optional)">
            <Textarea name="note" placeholder="Optional" rows={2} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending || !teamMemberId}>
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
