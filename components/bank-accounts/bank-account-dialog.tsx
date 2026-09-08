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
import { TableCell, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { enqueueMutation } from "@/lib/sync/mutate";
import { formDataToRecord } from "@/lib/sync/actions-registry";
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
      .map(
        (field) =>
          [BANK_FIELD_LABELS[field], FIELD_VALUES[field](entry)] as const,
      )
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
  locked = false,
  onUnlock,
}: {
  bankAccount?: BankAccountEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
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
    const fields = formDataToRecord(formData);
    const label = `bank account "${fields.bankName}"`;
    startTransition(async () => {
      const result = isEdit
        ? await enqueueMutation({
            key: "updateBankAccount",
            payload: { id: bankAccount.id, formData: fields },
            label,
          })
        : await enqueueMutation({ key: "createBankAccount", payload: fields, label });
      if (result.ok) {
        if (!isEdit) {
          formRef.current?.reset();
          setCurrency("USD");
        }
        setOpen(false);
      } else {
        setError(result.error);
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
      <DialogContent className="sm:max-w-2xl">
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
              disabled={locked}
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
              disabled={locked}
              defaultValue={bankAccount?.bankName}
            />
          </Field>

          <Field label="Account holder name">
            <Input
              name="accountHolderName"
              placeholder="Name on the account"
              required
              disabled={locked}
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
                  disabled={locked}
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
              disabled={locked}
              defaultValue={bankAccount?.swift}
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
              <Button key="save" type="submit" loading={pending}>
                {pending
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Save bank account"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BankAccountRowActions({
  entry,
  children,
}: {
  entry: BankAccountEntry;
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
      <TableRow className="cursor-pointer" onClick={openView}>
        {children}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end">
            <BankAccountActionsMenu
              onCopy={handleCopy}
              onEdit={openEdit}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </TableCell>
      </TableRow>
      <BankAccountDialog
        bankAccount={entry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locked={locked}
        onUnlock={() => setLocked(false)}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`${entry.currency} account at ${entry.bankName}`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deleteBankAccount",
            payload: { id: entry.id },
            label: `bank account "${entry.bankName}"`,
          });
          if (!result.ok) throw new Error(result.error);
        }}
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
