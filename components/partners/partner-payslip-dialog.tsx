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
import type { PartnerAccrual } from "@/actions/partners/queries";

export type PartnerOption = { id: string; name: string };

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatPkr(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Pending, unpaid payouts (accrued at contract completion, no payslip
 * issued yet) are the "project" options here — picking one auto-fills the
 * amount from the already-booked share instead of requiring it typed by
 * hand, and shows the cost breakdown behind it. "No specific project"
 * stays available for a manual/advance payment with no completed contract
 * behind it, where the amount is still typed in freely. */
export function PartnerPayslipDialog({
  partners,
  accruals,
}: {
  partners: PartnerOption[];
  accruals: PartnerAccrual[];
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

  const partnerAccruals = accruals.filter((a) => a.partnerId === partnerId);
  const selectedAccrual = partnerAccruals.find((a) => a.contractId === contractId);

  function onPartnerChange(id: string | null) {
    setPartnerId(id ?? "");
    setContractId("");
    setAmount("");
  }

  function onContractChange(id: string | null) {
    setContractId(id ?? "");
    const accrual = partnerAccruals.find((a) => a.contractId === id);
    setAmount(accrual ? String(accrual.amount) : "");
  }

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
              onValueChange={onPartnerChange}
              options={partners.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select partner"
              searchPlaceholder="Search partners…"
              emptyText="No partners found."
            />
            <input type="hidden" name="partnerId" value={partnerId} />
          </Field>

          {partnerId && (
            <Field label="Pending payout / project">
              <Combobox
                value={contractId}
                onValueChange={onContractChange}
                options={[
                  { value: "", label: "No specific project (manual)" },
                  ...partnerAccruals.map((a) => ({
                    value: a.contractId,
                    label: `${a.projectName} — ${formatPkr(a.amount)} owed`,
                  })),
                ]}
                placeholder="No specific project"
                searchPlaceholder="Search projects…"
                emptyText="This partner has no pending payouts."
              />
              <input type="hidden" name="contractId" value={contractId} />
            </Field>
          )}

          {selectedAccrual && (
            <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2.5 text-xs">
              <span className="mb-0.5 font-medium text-foreground">
                Cost breakdown — {selectedAccrual.projectName}
              </span>
              {selectedAccrual.revenueAmount != null && (
                <BreakdownRow label="Project revenue" value={formatPkr(selectedAccrual.revenueAmount)} />
              )}
              {selectedAccrual.workCostAmount != null && (
                <BreakdownRow label="Work cost" value={`-${formatPkr(selectedAccrual.workCostAmount)}`} />
              )}
              {!!selectedAccrual.projectExpensesAmount && (
                <BreakdownRow
                  label="Project expenses"
                  value={`-${formatPkr(selectedAccrual.projectExpensesAmount)}`}
                />
              )}
              {selectedAccrual.profitAmount != null && (
                <BreakdownRow label="Net profit" value={formatPkr(selectedAccrual.profitAmount)} />
              )}
              <BreakdownRow
                label={`Partner share${
                  selectedAccrual.sharePercentageUsed != null
                    ? ` (${selectedAccrual.sharePercentageUsed}%)`
                    : ""
                }`}
                value={formatPkr(selectedAccrual.amount)}
                emphasize
              />
            </div>
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

function BreakdownRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${emphasize ? "font-medium text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
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
