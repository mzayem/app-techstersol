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
import { missingChoices, submitForm } from "@/lib/form-submit";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { SENSITIVE_BANK_FIELDS } from "@/lib/bank-accounts/mask";
import { actionErrorMessage } from "@/lib/action-error";
import { revealBankAccount } from "@/actions/bank-accounts/actions";

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
  canEdit = true,
}: {
  bankAccount?: BankAccountEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
  /** Whether the viewer is allowed to unlock this dialog at all — a
   * view-only role never gets the "Update" button, not even disabled. */
  canEdit?: boolean;
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
    const missing = missingChoices(formData, {
      currency: "a currency",
    });
    if (missing) {
      setError(missing);
      return;
    }
    const fields = formDataToRecord(formData);
    const label = `bank account "${fields.bankName}"`;
    startTransition(async () => {
      const result = isEdit
        ? await enqueueMutation({
            key: "updateBankAccount",
            payload: { id: bankAccount.id, formData: fields },
            label,
          })
        : await enqueueMutation({
            key: "createBankAccount",
            payload: fields,
            label,
          });
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // A failed save's message shouldn't greet you next time.
        if (!next) setError(null);
      }}
    >
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
        <form
          ref={formRef}
          onSubmit={(event) => submitForm(event, onSubmit)}
          className="flex flex-col gap-3"
        >
          <Field label="Currency">
            <Select
              name="currency"
              value={currency}
              onValueChange={(v) =>
                setCurrency((v ?? "") as PaymentCurrency | "")
              }
              disabled={locked}
            >
              <SelectTrigger data-required className="w-full">
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
          {locked && canEdit && (
            <DialogFooter>
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
            </DialogFooter>
          )}
          {!locked && (
            <DialogFooter>
              <Button key="save" type="submit" loading={pending}>
                {pending
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Save bank account"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The account's detail lines, with the account number / IBAN masked
 * ("•••• 1234") until "Reveal" fetches the real ones from the server. */
export function BankDetailsCell({ entry }: { entry: BankAccountEntry }) {
  const [revealed, setRevealed] = React.useState<{
    accountNumber: string | null;
    iban: string | null;
  } | null>(null);
  const [loading, startLoading] = React.useTransition();
  const hasSecret = SENSITIVE_BANK_FIELDS.some(
    (field) => CURRENCY_FIELDS[entry.currency].includes(field) && entry[field],
  );

  function toggle() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    startLoading(async () => {
      try {
        setRevealed(await revealBankAccount(entry.id));
      } catch (e) {
        toast.add({
          title: actionErrorMessage(e, "Couldn't load the account details"),
          type: "error",
        });
      }
    });
  }

  const shown = revealed ? { ...entry, ...revealed } : entry;
  return (
    <div className="flex items-start gap-2">
      <div>
        {CURRENCY_FIELDS[entry.currency].map((field) => (
          <div key={field} className="text-xs whitespace-nowrap">
            {BANK_FIELD_LABELS[field]}: {shown[field] ?? "—"}
          </div>
        ))}
      </div>
      {hasSecret && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            revealed ? "Hide account details" : "Reveal account details"
          }
          title={revealed ? "Hide" : "Reveal"}
          loading={loading}
          onClick={toggle}
        >
          {!loading && (revealed ? <EyeOffIcon /> : <EyeIcon />)}
        </Button>
      )}
    </div>
  );
}

export function BankAccountRowActions({
  entry,
  children,
  canEdit = true,
  canDelete = true,
}: {
  entry: BankAccountEntry;
  children: React.ReactNode;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [locked, setLocked] = React.useState(true);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  // `entry` only carries masked numbers; the dialog and the copied text
  // need the real ones — and the edit form must never save "•••• 1234"
  // back over a real account number.
  const [fullEntry, setFullEntry] = React.useState<BankAccountEntry | null>(
    null,
  );

  async function loadFullEntry() {
    if (fullEntry) return fullEntry;
    const secrets = await revealBankAccount(entry.id);
    const full = { ...entry, ...secrets };
    setFullEntry(full);
    return full;
  }

  async function openDialog(asLocked: boolean) {
    try {
      await loadFullEntry();
      setLocked(asLocked);
      setDialogOpen(true);
    } catch (e) {
      toast.add({
        title: actionErrorMessage(e, "Couldn't load the account details"),
        type: "error",
      });
    }
  }

  function openView() {
    void openDialog(true);
  }

  function openEdit() {
    void openDialog(false);
  }

  async function handleCopy() {
    try {
      const full = await loadFullEntry();
      await navigator.clipboard.writeText(formatBankDetails(full));
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
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </TableCell>
      </TableRow>
      {fullEntry && (
        <BankAccountDialog
          bankAccount={fullEntry}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          locked={locked}
          onUnlock={() => setLocked(false)}
          canEdit={canEdit}
        />
      )}
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
