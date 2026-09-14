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
import { Switch } from "@/components/ui/switch";
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
  createPartner,
  deletePartner,
  updatePartner,
} from "@/actions/partners/actions";
import { TableCell, TableRow } from "@/components/ui/table";
import { TeamActionsMenu } from "@/components/team/team-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type PartnerEntry = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  currency: PaymentCurrency;
  sharePercentage: number;
  payslipEmailsEnabled: boolean;
  chatEnabled: boolean;
};

export function PartnerDialog({
  partner,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  locked = false,
  onUnlock,
  canEdit = true,
}: {
  partner?: PartnerEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
  /** Whether the viewer is allowed to unlock this dialog at all — a
   * view-only role never gets the "Update" button, not even disabled. */
  canEdit?: boolean;
}) {
  const isEdit = !!partner;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [currency, setCurrency] = React.useState<PaymentCurrency | "">(
    partner?.currency ?? "",
  );
  const [email, setEmail] = React.useState(partner?.email ?? "");
  const [payslipEmailsEnabled, setPayslipEmailsEnabled] = React.useState(
    partner?.payslipEmailsEnabled ?? true,
  );
  const [chatEnabled, setChatEnabled] = React.useState(
    partner?.chatEnabled ?? false,
  );

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updatePartner(partner.id, formData);
        } else {
          await createPartner(formData);
          formRef.current?.reset();
          setCurrency("");
          setEmail("");
          setPayslipEmailsEnabled(true);
          setChatEnabled(false);
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
          Add partner
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit partner" : "Add partner"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <Input
              name="name"
              placeholder="Full name"
              required
              disabled={locked}
              defaultValue={partner?.name}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone (optional)">
              <Input
                type="tel"
                name="phone"
                placeholder="+92 300 1234567"
                disabled={locked}
                defaultValue={partner?.phone ?? undefined}
              />
            </Field>
            <Field label="Email (optional)">
              <Input
                type="email"
                name="email"
                placeholder="name@example.com"
                disabled={locked}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment currency">
              <Select
                name="currency"
                value={currency}
                onValueChange={(v) => v && setCurrency(v as PaymentCurrency)}
                disabled={locked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
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
            <Field label="Default profit share (%)">
              <Input
                type="number"
                name="sharePercentage"
                min="0"
                max="100"
                step="0.01"
                placeholder="0.00"
                required
                disabled={locked}
                defaultValue={partner?.sharePercentage ?? undefined}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md ring-1 ring-foreground/10 px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Payslip emails</span>
              <span className="text-xs text-muted-foreground">
                {email
                  ? "Email a copy of each payslip (with PDF) to this address."
                  : "Add an email address above to enable this."}
              </span>
            </div>
            <Switch
              checked={payslipEmailsEnabled && !!email}
              onCheckedChange={setPayslipEmailsEnabled}
              disabled={locked || !email}
            />
            <input
              type="hidden"
              name="payslipEmailsEnabled"
              value={payslipEmailsEnabled && !!email ? "true" : "false"}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md ring-1 ring-foreground/10 px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Project chat access</span>
              <span className="text-xs text-muted-foreground">
                Allow this partner to post in project chat they can see
                (read-only otherwise).
              </span>
            </div>
            <Switch
              checked={chatEnabled}
              onCheckedChange={setChatEnabled}
              disabled={locked}
            />
            <input
              type="hidden"
              name="chatEnabled"
              value={chatEnabled ? "true" : "false"}
            />
          </div>
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
                {pending ? "Saving…" : isEdit ? "Save changes" : "Save partner"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PartnerRowActions({
  entry,
  children,
  canEdit = true,
  canDelete = true,
}: {
  entry: PartnerEntry;
  children: React.ReactNode;
  canEdit?: boolean;
  canDelete?: boolean;
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
            <TeamActionsMenu
              onEdit={openEdit}
              onDelete={() => setDeleteOpen(true)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </TableCell>
      </TableRow>
      <PartnerDialog
        partner={entry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locked={locked}
        onUnlock={() => setLocked(false)}
        canEdit={canEdit}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`partner ${entry.name}`}
        onDelete={deletePartner.bind(null, entry.id)}
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
