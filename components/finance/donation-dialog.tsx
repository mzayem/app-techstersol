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
import { createDonation, deleteDonation, updateDonation } from "@/lib/finance/actions";
import { EntryActionsMenu } from "@/components/finance/entry-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type DonationEntry = {
  id: string;
  date: Date;
  name: string;
  amount: number;
};

export function DonationDialog({
  donation,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  donation?: DonationEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!donation;
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
          await updateDonation(donation.id, formData);
        } else {
          await createDonation(formData);
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
          Add donation
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit donation" : "Add donation"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Date">
            <Input
              type="date"
              name="date"
              required
              defaultValue={donation ? toDateInputValue(donation.date) : today()}
            />
          </Field>
          <Field label="Name">
            <Input
              name="name"
              placeholder="Recipient"
              required
              defaultValue={donation?.name}
            />
          </Field>
          <Field label="Amount (PKR)">
            <Input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
              defaultValue={donation?.amount}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save donation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DonationRowActions({ entry }: { entry: DonationEntry }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <EntryActionsMenu
        id={entry.id}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <DonationDialog donation={entry} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`donation to ${entry.name}`}
        onDelete={deleteDonation.bind(null, entry.id)}
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
