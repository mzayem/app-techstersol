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
import { REFERENCE_CURRENCIES, type ReferenceCurrency } from "@/lib/finance/constants";
import { createEarning, deleteEarning, updateEarning } from "@/lib/finance/actions";
import { EntryActionsMenu } from "@/components/finance/entry-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type EarningEntry = {
  id: string;
  date: Date;
  name: string;
  amount: number;
  teamPay: number;
  referenceAmount: number | null;
  referenceCurrency: ReferenceCurrency | null;
};

export function EarningDialog({
  earning,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  earning?: EarningEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!earning;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateEarning(earning.id, formData);
        } else {
          await createEarning(formData);
          formRef.current?.reset();
        }
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Add earning
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit earning" : "Add earning"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Date">
            <Input
              type="date"
              name="date"
              required
              defaultValue={earning ? toDateInputValue(earning.date) : today()}
            />
          </Field>
          <Field label="Name">
            <Input
              name="name"
              placeholder="Client or project"
              required
              defaultValue={earning?.name}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (PKR)">
              <Input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
                defaultValue={earning?.amount}
              />
            </Field>
            <Field label="Team pay (PKR)">
              <Input
                type="number"
                name="teamPay"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={earning?.teamPay ?? "0"}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reference amount">
              <Input
                type="number"
                name="referenceAmount"
                min="0"
                step="0.01"
                placeholder="Optional"
                defaultValue={earning?.referenceAmount ?? undefined}
              />
            </Field>
            <Field label="Reference currency">
              <Select
                name="referenceCurrency"
                defaultValue={earning?.referenceCurrency ?? undefined}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {REFERENCE_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save earning"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EarningRowActions({ entry }: { entry: EarningEntry }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <EntryActionsMenu
        id={entry.id}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <EarningDialog earning={entry} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`earning from ${entry.name}`}
        onDelete={deleteEarning.bind(null, entry.id)}
      />
    </>
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
