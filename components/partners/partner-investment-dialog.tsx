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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { enqueueMutation } from "@/lib/sync/mutate";
import { formDataToRecord } from "@/lib/sync/actions-registry";
import { INVESTMENT_METHOD_LABELS } from "@/lib/partners/investment-constants";
import type { InvestmentMethod } from "@/generated/prisma/client";
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

/** Records a partner's contribution into their investment wallet — either
 * a redirected pending payout (picking a project auto-fills the amount
 * from the already-booked accrual, same as PartnerPayslipDialog) or fresh
 * cash/online money handed over directly, with an optional transaction id
 * for the online case. */
export function PartnerInvestmentDialog({
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
  const [method, setMethod] = React.useState<InvestmentMethod>("CASH");
  const [contractId, setContractId] = React.useState("");
  const [amount, setAmount] = React.useState("");

  const partnerAccruals = accruals.filter((a) => a.partnerId === partnerId);
  const selectedAccrual = partnerAccruals.find(
    (a) => a.contractId === contractId,
  );

  function resetForm() {
    formRef.current?.reset();
    setPartnerId("");
    setMethod("CASH");
    setContractId("");
    setAmount("");
  }

  function onPartnerChange(id: string | null) {
    setPartnerId(id ?? "");
    setContractId("");
    setAmount("");
  }

  function onMethodChange(value: string | null) {
    setMethod((value as InvestmentMethod) ?? "CASH");
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
        key: "createPartnerInvestment",
        payload: fields,
        label: "partner investment",
      });
      if (result.ok) {
        resetForm();
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
        Add investment
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add partner investment</DialogTitle>
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

          <Field label="Funded by">
            <Select name="method" value={method} onValueChange={onMethodChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Funded by" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INVESTMENT_METHOD_LABELS) as InvestmentMethod[]).map(
                  (m) => (
                    <SelectItem key={m} value={m}>
                      {INVESTMENT_METHOD_LABELS[m]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>

          {method === "PENDING_PAYMENT" && partnerId && (
            <Field label="Pending payout / project">
              <Combobox
                value={contractId}
                onValueChange={onContractChange}
                options={partnerAccruals.map((a) => ({
                  value: a.contractId,
                  label: `${a.projectName} — ${formatPkr(a.amount)} owed`,
                }))}
                placeholder="Select a pending payout"
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
              <BreakdownRow
                label={`Pending payout${
                  selectedAccrual.sharePercentageUsed != null
                    ? ` (${selectedAccrual.sharePercentageUsed}% share)`
                    : ""
                }`}
                value={formatPkr(selectedAccrual.amount)}
                emphasize
              />
            </div>
          )}

          {method === "ONLINE" && (
            <Field label="Transaction ID (optional)">
              <Input name="transactionId" placeholder="TID" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <DatePicker name="date" required defaultValue={todayInput()} />
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
            <Button
              type="submit"
              disabled={
                !partnerId || (method === "PENDING_PAYMENT" && !contractId)
              }
              loading={pending}
            >
              {pending ? "Saving…" : "Save investment"}
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
    <div
      className={`flex items-center justify-between ${emphasize ? "font-medium text-foreground" : "text-muted-foreground"}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
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
