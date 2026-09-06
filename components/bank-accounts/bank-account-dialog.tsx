"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  PAYMENT_CURRENCIES,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import {
  BANK_FIELD_LABELS,
  CURRENCY_FIELDS,
  CURRENCY_OPTIONAL_FIELDS,
  type BankFieldKey,
} from "@/lib/bank-accounts/constants";
import { toast } from "@/components/ui/toast";
import {
  createBankAccount,
  deleteBankAccount,
  updateBankAccount,
} from "@/actions/bank-accounts/actions";
import { BankAccountActionsMenu } from "@/components/bank-accounts/bank-account-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type BankAccountEntry = {
  id: string;
  currency: PaymentCurrency;
  bankName: string;
  accountHolderName: string;
  swift: string;
  accountType: string | null;
  routingNumber: string | null;
  accountNumber: string | null;
  iban: string | null;
  sortCode: string | null;
  bsbCode: string | null;
};

const FIELD_VALUES: Record<
  BankFieldKey,
  (entry: BankAccountEntry) => string | null
> = {
  accountType: (e) => e.accountType,
  routingNumber: (e) => e.routingNumber,
  accountNumber: (e) => e.accountNumber,
  iban: (e) => e.iban,
  sortCode: (e) => e.sortCode,
  bsbCode: (e) => e.bsbCode,
};

function formatBankDetails(entry: BankAccountEntry) {
  const lines = [
    `Here is my ${entry.currency} bank details:`,
    "",
    `Bank: ${entry.bankName}`,
    `Account holder: ${entry.accountHolderName}`,
    ...CURRENCY_FIELDS[entry.currency]
      .map((field) => [BANK_FIELD_LABELS[field], FIELD_VALUES[field](entry)] as const)
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`),
    `SWIFT: ${entry.swift}`,
  ];
  return lines.join("\n");
}

export function BankAccountDialog({
  bankAccount,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  bankAccount?: BankAccountEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!bankAccount;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [currency, setCurrency] = React.useState<PaymentCurrency | "">(
    bankAccount?.currency ?? "USD",
  );

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateBankAccount(bankAccount.id, formData);
        } else {
          await createBankAccount(formData);
          formRef.current?.reset();
          setCurrency("USD");
        }
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const fields = currency ? CURRENCY_FIELDS[currency] : [];
  const optionalFields = currency
    ? CURRENCY_OPTIONAL_FIELDS[currency]
    : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Add bank account
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit bank account" : "Add bank account"}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Currency">
            <Select
              name="currency"
              value={currency}
              onValueChange={(v) =>
                setCurrency((v ?? "") as PaymentCurrency | "")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Currency</SelectItem>
                {PAYMENT_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Bank name">
            <Input
              name="bankName"
              placeholder="Bank name"
              required
              defaultValue={bankAccount?.bankName}
            />
          </Field>

          <Field label="Account holder name">
            <Input
              name="accountHolderName"
              placeholder="Name on the account"
              required
              defaultValue={bankAccount?.accountHolderName}
            />
          </Field>

          {fields.map((field) => {
            const isOptional = optionalFields?.includes(field);
            return (
              <Field key={field} label={BANK_FIELD_LABELS[field]}>
                <Input
                  name={field}
                  placeholder={BANK_FIELD_LABELS[field]}
                  required={!isOptional}
                  defaultValue={
                    bankAccount
                      ? (FIELD_VALUES[field](bankAccount) ?? undefined)
                      : undefined
                  }
                />
              </Field>
            );
          })}

          <Field label="SWIFT / BIC">
            <Input
              name="swift"
              placeholder="SWIFT / BIC code"
              required
              defaultValue={bankAccount?.swift}
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Save bank account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BankAccountRowActions({ entry }: { entry: BankAccountEntry }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatBankDetails(entry));
      toast.add({ title: "Copied to clipboard", type: "success" });
    } catch {
      toast.add({ title: "Couldn't copy to clipboard", type: "error" });
    }
  }

  return (
    <>
      <BankAccountActionsMenu
        onCopy={handleCopy}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <BankAccountDialog
        bankAccount={entry}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`${entry.currency} account at ${entry.bankName}`}
        onDelete={deleteBankAccount.bind(null, entry.id)}
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
