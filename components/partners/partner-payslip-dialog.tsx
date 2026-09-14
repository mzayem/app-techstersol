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
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { enqueueMutation } from "@/lib/sync/mutate";
import { formDataToRecord } from "@/lib/sync/actions-registry";

export type PartnerOption = { id: string; name: string };
export type PartnerContractOption = { id: string; projectName: string; partnerId: string | null };

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function PartnerPayslipDialog({
  partners,
  contracts,
}: {
  partners: PartnerOption[];
  contracts: PartnerContractOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [partnerId, setPartnerId] = React.useState("");
  const [contractId, setContractId] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState(todayInput());
  const [amount, setAmount] = React.useState("");

  const projectOptions = contracts.filter((c) => c.partnerId === partnerId);

  function onSubmit(formData: FormData) {
    setError(null);
    const fields = formDataToRecord(formData);
    startTransition(async () => {
      const result = await enqueueMutation({
        key: "createPartnerPayslip",
        payload: fields,
        label: "partner payslip",
      });
      if (result.ok) {
        formRef.current?.reset();
        setPartnerId("");
        setContractId("");
        setPeriodStart("");
        setPeriodEnd(todayInput());
        setAmount("");
        setOpen(false);
      } else {
        setError(result.error);
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
          <DialogTitle>Add partner payslip</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Partner">
            <Combobox
              value={partnerId}
              onValueChange={(v) => {
                setPartnerId(v);
                setContractId("");
              }}
              options={partners.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select partner"
              searchPlaceholder="Search partners…"
              emptyText="No partners found."
            />
            <input type="hidden" name="partnerId" value={partnerId} />
          </Field>

          {partnerId && (
            <Field label="Assigned project (optional)">
              <Combobox
                value={contractId}
                onValueChange={setContractId}
                options={projectOptions.map((c) => ({ value: c.id, label: c.projectName }))}
                placeholder="No specific project"
                searchPlaceholder="Search projects…"
                emptyText="This partner has no assigned projects."
              />
              <input type="hidden" name="contractId" value={contractId} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start">
              <DatePicker
                name="periodStart"
                required
                value={periodStart}
                onValueChange={setPeriodStart}
              />
            </Field>
            <Field label="Period end">
              <DatePicker
                name="periodEnd"
                required
                value={periodEnd}
                onValueChange={setPeriodEnd}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date">
              <DatePicker name="issueDate" required defaultValue={todayInput()} />
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
            <Button type="submit" disabled={!partnerId} loading={pending}>
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
