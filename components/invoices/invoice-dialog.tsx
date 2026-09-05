"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import {
  createInvoice,
  type InvoiceItemInput,
} from "@/actions/invoices/actions";

export type ClientOption = { id: string; name: string };

export type ContractOption = {
  id: string;
  clientId: string;
  projectName: string;
  currency: PaymentCurrency;
  paymentType: "PROJECT" | "MILESTONE";
  amount: number | null;
  milestones: { id: string; name: string; amount: number }[];
};

export type BankAccountOption = {
  id: string;
  currency: PaymentCurrency;
  bankName: string;
  accountHolderName: string;
};

function contractItems(contract: ContractOption): InvoiceItemInput[] {
  if (contract.paymentType === "PROJECT") {
    return [
      { description: contract.projectName, amount: contract.amount ?? 0 },
    ];
  }
  return contract.milestones.map((m) => ({
    description: `${contract.projectName} — ${m.name}`,
    amount: m.amount,
  }));
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function InvoiceDialog({
  clients,
  contracts,
  bankAccounts,
}: {
  clients: ClientOption[];
  contracts: ContractOption[];
  bankAccounts: BankAccountOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [clientId, setClientId] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bankAccountId, setBankAccountId] = React.useState("");
  const [discountInput, setDiscountInput] = React.useState("");

  const clientContracts = React.useMemo(
    () => contracts.filter((c) => c.clientId === clientId),
    [contracts, clientId],
  );

  const selectedContracts = React.useMemo(
    () => clientContracts.filter((c) => selectedIds.has(c.id)),
    [clientContracts, selectedIds],
  );

  const currency = selectedContracts[0]?.currency ?? null;

  const items = React.useMemo(
    () => selectedContracts.flatMap(contractItems),
    [selectedContracts],
  );
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const discount = Math.min(Math.max(Number(discountInput) || 0, 0), total);
  const balanceDue = total - discount;

  const matchingBankAccounts = React.useMemo(
    () => (currency ? bankAccounts.filter((b) => b.currency === currency) : []),
    [bankAccounts, currency],
  );

  // Fall back to the first currency-matched account whenever the explicitly
  // chosen one isn't (or is no longer) among the matches for this currency.
  const effectiveBankAccountId = matchingBankAccounts.some(
    (b) => b.id === bankAccountId,
  )
    ? bankAccountId
    : (matchingBankAccounts[0]?.id ?? "");

  function onClientChange(id: string | null) {
    setClientId(id ?? "");
    setSelectedIds(new Set());
  }

  function toggleContract(contract: ContractOption) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contract.id)) {
        next.delete(contract.id);
      } else {
        next.add(contract.id);
      }
      return next;
    });
  }

  function resetForm() {
    setClientId("");
    setSelectedIds(new Set());
    setBankAccountId("");
    setDiscountInput("");
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createInvoice(formData, [...selectedIds], items);
        formRef.current?.reset();
        resetForm();
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
        Add invoice
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add invoice</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          action={onSubmit}
          className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1"
        >
          <Field label="Client">
            <Select value={clientId} onValueChange={onClientChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="clientId" value={clientId} />
          </Field>

          {clientId && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Contracts</span>
              {clientContracts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  This client has no contracts yet.
                </p>
              )}
              {clientContracts.map((contract) => {
                const disabled =
                  currency !== null && contract.currency !== currency;
                const contractTotal = contractItems(contract).reduce(
                  (sum, item) => sum + item.amount,
                  0,
                );
                return (
                  <label
                    key={contract.id}
                    className={
                      "flex items-center justify-between gap-2 rounded-md border border-input px-2.5 py-2 text-sm " +
                      (disabled ? "opacity-50" : "")
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.has(contract.id)}
                        disabled={disabled}
                        onCheckedChange={() => toggleContract(contract)}
                      />
                      {contract.projectName}
                    </span>
                    <span className="text-muted-foreground">
                      {formatContractAmount(contractTotal, contract.currency)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {items.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{item.description}</span>
                  <span className="tabular-nums">
                    {currency && formatContractAmount(item.amount, currency)}
                  </span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-1">
                <span>Total</span>
                <span className="tabular-nums">
                  {currency && formatContractAmount(total, currency)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{currency && formatContractAmount(discount, currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 font-medium">
                <span>Balance due</span>
                <span className="tabular-nums">
                  {currency && formatContractAmount(balanceDue, currency)}
                </span>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <Field label="Discount (optional)">
              <Input
                type="number"
                name="discount"
                min="0"
                step="0.01"
                max={total}
                placeholder="0.00"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
              />
            </Field>
          )}

          <input type="hidden" name="currency" value={currency ?? ""} />

          <Field label="Bank account">
            <Select
              value={effectiveBankAccountId}
              onValueChange={(v) => setBankAccountId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a currency first" />
              </SelectTrigger>
              <SelectContent>
                {matchingBankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bankName} — {b.accountHolderName} ({b.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="bankAccountId"
              value={effectiveBankAccountId}
            />
            {currency && matchingBankAccounts.length === 0 && (
              <span className="text-xs text-destructive">
                No {currency} bank account on file — add one under Bank Details.
              </span>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date">
              <Input
                type="date"
                name="issueDate"
                required
                defaultValue={todayInput()}
              />
            </Field>
            <Field label="Due date">
              <Input type="date" name="dueDate" required />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending || items.length === 0}>
              {pending ? "Saving…" : "Save invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
