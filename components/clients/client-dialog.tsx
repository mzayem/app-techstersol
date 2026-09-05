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
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  PAYMENT_CURRENCIES,
  type ClientStatus,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import { COUNTRIES } from "@/lib/clients/countries";
import { createClient, deleteClient, updateClient } from "@/actions/clients/actions";
import { ClientActionsMenu } from "@/components/clients/client-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type ClientEntry = {
  id: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  currency: PaymentCurrency;
  status: ClientStatus;
};

export function ClientDialog({
  client,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  client?: ClientEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!client;
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
          await updateClient(client.id, formData);
        } else {
          await createClient(formData);
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
          Add client
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "Add client"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <Input
              name="name"
              placeholder="Client name"
              required
              defaultValue={client?.name}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input
                type="tel"
                name="phone"
                placeholder="+92 300 1234567"
                required
                defaultValue={client?.phone}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                name="email"
                placeholder="client@example.com"
                required
                defaultValue={client?.email}
              />
            </Field>
          </div>
          <Field label="Country">
            <Select name="country" defaultValue={client?.country}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment currency">
              <Select name="currency" defaultValue={client?.currency}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={client?.status ?? "ACTIVE"}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CLIENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClientRowActions({ entry }: { entry: ClientEntry }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <ClientActionsMenu onEdit={() => setEditOpen(true)} onDelete={() => setDeleteOpen(true)} />
      <ClientDialog client={entry} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`client ${entry.name}`}
        onDelete={deleteClient.bind(null, entry.id)}
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
