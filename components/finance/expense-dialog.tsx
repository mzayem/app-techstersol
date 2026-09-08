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
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/finance/amount-input";
import {
  EXPENSE_CATEGORIES,
  BUCKET_LABELS,
  type ExpenseCategory,
} from "@/lib/finance/constants";
import { resolveAmountField } from "@/lib/finance/expression";
import { enqueueMutation } from "@/lib/sync/mutate";
import { formDataToRecord } from "@/lib/sync/actions-registry";
import { TableCell, TableRow } from "@/components/ui/table";
import { EntryActionsMenu } from "@/components/finance/entry-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type ExpenseEntry = {
  id: string;
  date: Date;
  category: ExpenseCategory;
  name: string;
  amount: number;
};

export function ExpenseDialog({
  expense,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  locked = false,
  onUnlock,
}: {
  expense?: ExpenseEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
}) {
  const isEdit = !!expense;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    const amountError = resolveAmountField(formData, "amount", "Amount");
    if (amountError) {
      setError(amountError);
      return;
    }
    const fields = formDataToRecord(formData);
    const label = `expense "${fields.name}"`;
    startTransition(async () => {
      const result = isEdit
        ? await enqueueMutation({
            key: "updateExpense",
            payload: { id: expense.id, formData: fields },
            label,
          })
        : await enqueueMutation({ key: "createExpense", payload: fields, label });
      if (result.ok) {
        if (!isEdit) formRef.current?.reset();
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Add expense
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <DatePicker
                name="date"
                required
                disabled={locked}
                defaultValue={
                  expense ? toDateInputValue(expense.date) : today()
                }
              />
            </Field>
            <Field label="Type">
              <Select
                name="category"
                defaultValue={expense?.category ?? "EXPENSE"}
                disabled={locked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Type</SelectItem>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {BUCKET_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Name">
            <Input
              name="name"
              placeholder="What was it for"
              required
              disabled={locked}
              defaultValue={expense?.name}
            />
          </Field>
          <AmountInput
            name="amount"
            label="Amount (PKR)"
            disabled={locked}
            defaultValue={expense?.amount}
          />
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
                {pending ? "Saving…" : isEdit ? "Save changes" : "Save expense"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseRowActions({
  entry,
  children,
}: {
  entry: ExpenseEntry;
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
            <EntryActionsMenu
              id={entry.id}
              onEdit={openEdit}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </TableCell>
      </TableRow>
      <ExpenseDialog
        expense={entry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locked={locked}
        onUnlock={() => setLocked(false)}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`expense "${entry.name}"`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deleteExpense",
            payload: { id: entry.id },
            label: `expense "${entry.name}"`,
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
