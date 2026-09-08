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
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import { DEFAULT_DUE_DAYS } from "@/lib/invoices/constants";
import { type InvoiceItemInput } from "@/actions/invoices/actions";
import { enqueueMutation } from "@/lib/sync/mutate";
import { formDataToRecord } from "@/lib/sync/actions-registry";

export type ClientOption = { id: string; name: string };

export type LineOption = {
  contractId: string;
  milestoneId: string | null;
  clientId: string;
  currency: PaymentCurrency;
  label: string;
  remainingAmount: number;
};

export type BankAccountOption = {
  id: string;
  currency: PaymentCurrency;
  bankName: string;
  accountHolderName: string;
};

type PaymentMode = "FULL" | "PARTIAL";

function lineKey(option: Pick<LineOption, "contractId" | "milestoneId">) {
  return `${option.contractId}:${option.milestoneId ?? "project"}`;
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysInput(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function InvoiceDialog({
  clients,
  lineOptions,
  bankAccounts,
}: {
  clients: ClientOption[];
  lineOptions: LineOption[];
  bankAccounts: BankAccountOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [clientId, setClientId] = React.useState("");
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(
    new Set(),
  );
  const [mode, setMode] = React.useState<PaymentMode>("FULL");
  const [partialAmounts, setPartialAmounts] = React.useState<
    Record<string, string>
  >({});
  const [bankAccountId, setBankAccountId] = React.useState("");
  const [discountInput, setDiscountInput] = React.useState("");

  const [issueDateValue, setIssueDateValue] = React.useState(todayInput);
  const [dueDateValue, setDueDateValue] = React.useState(() =>
    addDaysInput(todayInput(), DEFAULT_DUE_DAYS),
  );
  const [dueDateTouched, setDueDateTouched] = React.useState(false);

  const clientLineOptions = React.useMemo(
    () => lineOptions.filter((o) => o.clientId === clientId),
    [lineOptions, clientId],
  );

  const selectedOptions = React.useMemo(
    () => clientLineOptions.filter((o) => selectedKeys.has(lineKey(o))),
    [clientLineOptions, selectedKeys],
  );

  const currency = selectedOptions[0]?.currency ?? null;

  const items: InvoiceItemInput[] = React.useMemo(
    () =>
      selectedOptions.map((option) => {
        const key = lineKey(option);
        const amount =
          mode === "FULL"
            ? option.remainingAmount
            : Math.min(
                Math.max(Number(partialAmounts[key]) || 0, 0),
                option.remainingAmount,
              );
        return {
          contractId: option.contractId,
          milestoneId: option.milestoneId,
          description: option.label,
          amount,
        };
      }),
    [selectedOptions, mode, partialAmounts],
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
    setSelectedKeys(new Set());
  }

  function toggleLine(option: LineOption) {
    const key = lineKey(option);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setPartialAmounts((amounts) =>
          amounts[key] !== undefined
            ? amounts
            : { ...amounts, [key]: String(option.remainingAmount) },
        );
      }
      return next;
    });
  }

  function onIssueDateChange(value: string) {
    setIssueDateValue(value);
    if (!dueDateTouched) setDueDateValue(addDaysInput(value, DEFAULT_DUE_DAYS));
  }

  function resetForm() {
    setClientId("");
    setSelectedKeys(new Set());
    setMode("FULL");
    setPartialAmounts({});
    setBankAccountId("");
    setDiscountInput("");
    setIssueDateValue(todayInput());
    setDueDateValue(addDaysInput(todayInput(), DEFAULT_DUE_DAYS));
    setDueDateTouched(false);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    const fields = formDataToRecord(formData);
    startTransition(async () => {
      const result = await enqueueMutation({
        key: "createInvoice",
        payload: { formData: fields, items },
        label: "invoice",
      });
      if (result.ok) {
        formRef.current?.reset();
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
        Add invoice
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add invoice</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
            <Field label="Client">
              <Combobox
                value={clientId}
                onValueChange={onClientChange}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select client"
                searchPlaceholder="Search clients…"
                emptyText="No clients found."
              />
              <input type="hidden" name="clientId" value={clientId} />
            </Field>

            {clientId && (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">
                  Contracts & milestones
                </span>
                {clientLineOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    This client has nothing left to invoice.
                  </p>
                )}
                {clientLineOptions.map((option) => {
                  const disabled =
                    currency !== null && option.currency !== currency;
                  const key = lineKey(option);
                  return (
                    <label
                      key={key}
                      className={
                        "flex items-center justify-between gap-2 rounded-md border border-input px-2.5 py-2 text-sm " +
                        (disabled ? "opacity-50" : "")
                      }
                    >
                      <span className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedKeys.has(key)}
                          disabled={disabled}
                          onCheckedChange={() => toggleLine(option)}
                        />
                        {option.label}
                      </span>
                      <span className="text-muted-foreground">
                        {formatContractAmount(
                          option.remainingAmount,
                          option.currency,
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedOptions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Payment</span>
                <div className="inline-flex w-fit overflow-hidden rounded-md ring-1 ring-input">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "FULL" ? "default" : "ghost"}
                    className="rounded-none"
                    onClick={() => setMode("FULL")}
                  >
                    Full payment
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "PARTIAL" ? "default" : "ghost"}
                    className="rounded-none"
                    onClick={() => setMode("PARTIAL")}
                  >
                    Partial payment
                  </Button>
                </div>
              </div>
            )}

            {mode === "PARTIAL" && selectedOptions.length > 0 && (
              <div className="flex flex-col gap-2">
                {selectedOptions.map((option) => {
                  const key = lineKey(option);
                  const amountValue =
                    partialAmounts[key] ?? String(option.remainingAmount);
                  const amount = Math.min(
                    Math.max(Number(amountValue) || 0, 0),
                    option.remainingAmount,
                  );
                  const remainingAfter = option.remainingAmount - amount;
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-1 rounded-md bg-muted p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          of{" "}
                          {formatContractAmount(
                            option.remainingAmount,
                            option.currency,
                          )}
                        </span>
                      </div>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={option.remainingAmount}
                        value={amountValue}
                        onChange={(e) =>
                          setPartialAmounts((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                      {remainingAfter > 0.01 && (
                        <span className="text-xs text-muted-foreground">
                          Remaining after this payment:{" "}
                          {formatContractAmount(
                            remainingAfter,
                            option.currency,
                          )}
                        </span>
                      )}
                    </div>
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
                  No {currency} bank account on file — add one under Bank
                  Details.
                </span>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Issue date">
                <DatePicker
                  name="issueDate"
                  required
                  value={issueDateValue}
                  onValueChange={onIssueDateChange}
                />
              </Field>
              <Field label="Due date">
                <DatePicker
                  name="dueDate"
                  required
                  value={dueDateValue}
                  onValueChange={(v) => {
                    setDueDateTouched(true);
                    setDueDateValue(v);
                  }}
                />
              </Field>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="submit"
              disabled={items.length === 0 || items.some((i) => !(i.amount > 0))}
              loading={pending}
            >
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
