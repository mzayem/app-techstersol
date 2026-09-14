"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { Switch } from "@/components/ui/switch";
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  PAYMENT_CURRENCIES,
  type ClientStatus,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import { COUNTRIES } from "@/lib/clients/countries";
import { enqueueMutation } from "@/lib/sync/mutate";
import { formDataToRecord } from "@/lib/sync/actions-registry";
import { TableCell, TableRow } from "@/components/ui/table";
import { ClientActionsMenu } from "@/components/clients/client-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: c }));

export type ClientEntry = {
  id: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  currency: PaymentCurrency;
  status: ClientStatus;
  emailNotificationsEnabled: boolean;
  broughtByPartnerId?: string | null;
  broughtByPartnerName?: string | null;
  phoneVisibleToPartner?: boolean;
  emailVisibleToPartner?: boolean;
};

export type PartnerOption = { id: string; name: string };

export function ClientDialog({
  client,
  partnerOptions = [],
  open: openProp,
  onOpenChange: onOpenChangeProp,
  locked = false,
  onUnlock,
  canEdit = true,
}: {
  client?: ClientEntry;
  /** Every Partner, for the "Brought by partner" combobox — optional
   * attribution, independent of Contract.partnerId. */
  partnerOptions?: PartnerOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
  /** Whether the viewer is allowed to unlock this dialog at all — a
   * view-only role never gets the "Update" button, not even disabled. */
  canEdit?: boolean;
}) {
  const isEdit = !!client;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [country, setCountry] = React.useState(client?.country ?? "");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = React.useState(
    client?.emailNotificationsEnabled ?? true,
  );
  const [broughtByPartnerId, setBroughtByPartnerId] = React.useState(
    client?.broughtByPartnerId ?? "",
  );
  const [phoneVisibleToPartner, setPhoneVisibleToPartner] = React.useState(
    client?.phoneVisibleToPartner ?? false,
  );
  const [emailVisibleToPartner, setEmailVisibleToPartner] = React.useState(
    client?.emailVisibleToPartner ?? false,
  );

  function onSubmit(formData: FormData) {
    setError(null);
    const fields = formDataToRecord(formData);
    const label = `client "${fields.name}"`;
    startTransition(async () => {
      const result = isEdit
        ? await enqueueMutation({
            key: "updateClient",
            payload: { id: client.id, formData: fields },
            label,
          })
        : await enqueueMutation({ key: "createClient", payload: fields, label });
      if (result.ok) {
        if (!isEdit) {
          formRef.current?.reset();
          setCountry("");
          setEmailNotificationsEnabled(true);
          setBroughtByPartnerId("");
          setPhoneVisibleToPartner(false);
          setEmailVisibleToPartner(false);
        }
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
          Add client
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "Add client"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <Input
              name="name"
              placeholder="Client name"
              required
              disabled={locked}
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
                disabled={locked}
                defaultValue={client?.phone}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                name="email"
                placeholder="client@example.com"
                required
                disabled={locked}
                defaultValue={client?.email}
              />
            </Field>
          </div>
          <Field label="Country">
            <Combobox
              value={country}
              onValueChange={setCountry}
              options={COUNTRY_OPTIONS}
              placeholder="Select country"
              searchPlaceholder="Search countries…"
              emptyText="No countries found."
              disabled={locked}
            />
            <input type="hidden" name="country" value={country} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment currency">
              <Select
                name="currency"
                defaultValue={client?.currency}
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
            <Field label="Status">
              <Select
                name="status"
                defaultValue={client?.status ?? "ACTIVE"}
                disabled={locked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Status</SelectItem>
                  {CLIENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CLIENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md ring-1 ring-foreground/10 px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Email notifications</span>
              <span className="text-xs text-muted-foreground">
                Master switch for contract-status emails to this client. Off disables every
                project&apos;s notifications, regardless of that project&apos;s own setting.
              </span>
            </div>
            <Switch
              checked={emailNotificationsEnabled}
              onCheckedChange={setEmailNotificationsEnabled}
              disabled={locked}
            />
            <input
              type="hidden"
              name="emailNotificationsEnabled"
              value={emailNotificationsEnabled ? "true" : "false"}
            />
          </div>
          <Field label="Brought by partner (optional)">
            <Combobox
              value={broughtByPartnerId}
              onValueChange={(v) => {
                setBroughtByPartnerId(v);
                if (!v) {
                  setPhoneVisibleToPartner(false);
                  setEmailVisibleToPartner(false);
                }
              }}
              options={partnerOptions.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="No partner attributed"
              searchPlaceholder="Search partners…"
              emptyText="No partners found."
              disabled={locked}
            />
            <input type="hidden" name="broughtByPartnerId" value={broughtByPartnerId} />
          </Field>
          {broughtByPartnerId && (
            <div className="flex flex-col gap-2 rounded-md ring-1 ring-foreground/10 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Show phone to partner</span>
                  <span className="text-xs text-muted-foreground">
                    Lets the attributed partner see this client&apos;s phone number in their
                    portal.
                  </span>
                </div>
                <Switch
                  checked={phoneVisibleToPartner}
                  onCheckedChange={setPhoneVisibleToPartner}
                  disabled={locked}
                />
                <input
                  type="hidden"
                  name="phoneVisibleToPartner"
                  value={phoneVisibleToPartner ? "true" : "false"}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Show email to partner</span>
                  <span className="text-xs text-muted-foreground">
                    Lets the attributed partner see this client&apos;s email in their portal.
                  </span>
                </div>
                <Switch
                  checked={emailVisibleToPartner}
                  onCheckedChange={setEmailVisibleToPartner}
                  disabled={locked}
                />
                <input
                  type="hidden"
                  name="emailVisibleToPartner"
                  value={emailVisibleToPartner ? "true" : "false"}
                />
              </div>
            </div>
          )}
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
                {pending ? "Saving…" : isEdit ? "Save changes" : "Save client"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClientRowActions({
  entry,
  children,
  partnerOptions = [],
  canEdit = true,
  canDelete = true,
}: {
  entry: ClientEntry;
  children: React.ReactNode;
  partnerOptions?: PartnerOption[];
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
            <ClientActionsMenu
              onEdit={openEdit}
              onDelete={() => setDeleteOpen(true)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </TableCell>
      </TableRow>
      <ClientDialog
        client={entry}
        partnerOptions={partnerOptions}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locked={locked}
        onUnlock={() => setLocked(false)}
        canEdit={canEdit}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`client ${entry.name}`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deleteClient",
            payload: { id: entry.id },
            label: `client "${entry.name}"`,
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
