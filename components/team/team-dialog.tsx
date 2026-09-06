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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";
import { COUNTRIES } from "@/lib/clients/countries";
import {
  TEAM_MEMBER_TYPES,
  TEAM_MEMBER_TYPE_LABELS,
  type TeamMemberType,
} from "@/lib/team/constants";
import {
  createTeamMember,
  deleteTeamMember,
  updateTeamMember,
} from "@/actions/team/actions";
import { TableCell, TableRow } from "@/components/ui/table";
import { TeamActionsMenu } from "@/components/team/team-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: c }));

export type TeamMemberEntry = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  currency: PaymentCurrency;
  address: string | null;
  type: TeamMemberType;
  hourlyRate: number | null;
};

export function TeamMemberDialog({
  member,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  locked = false,
  onUnlock,
}: {
  member?: TeamMemberEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
}) {
  const isEdit = !!member;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [country, setCountry] = React.useState(member?.country ?? "");
  const [memberType, setMemberType] = React.useState<TeamMemberType>(
    member?.type ?? "PROJECT_BASED",
  );
  const [currency, setCurrency] = React.useState<PaymentCurrency | "">(
    member?.currency ?? "",
  );

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateTeamMember(member.id, formData);
        } else {
          await createTeamMember(formData);
          formRef.current?.reset();
          setCountry("");
          setMemberType("PROJECT_BASED");
          setCurrency("");
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
          Add team member
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit team member" : "Add team member"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <Input
              name="name"
              placeholder="Full name"
              required
              disabled={locked}
              defaultValue={member?.name}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Member type">
              <Select
                name="type"
                value={memberType}
                onValueChange={(v) => v && setMemberType(v as TeamMemberType)}
                disabled={locked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_MEMBER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TEAM_MEMBER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {memberType === "HOURLY" && (
              <Field label={`Rate per hour${currency ? ` (${currency})` : ""}`}>
                <Input
                  type="number"
                  name="hourlyRate"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                  disabled={locked}
                  defaultValue={member?.hourlyRate ?? undefined}
                />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone (optional)">
              <Input
                type="tel"
                name="phone"
                placeholder="+92 300 1234567"
                disabled={locked}
                defaultValue={member?.phone ?? undefined}
              />
            </Field>
            <Field label="Email (optional)">
              <Input
                type="email"
                name="email"
                placeholder="name@example.com"
                disabled={locked}
                defaultValue={member?.email ?? undefined}
              />
            </Field>
          </div>
          <Field label="Country (optional)">
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
          <Field label="Address (optional)">
            <Textarea
              name="address"
              placeholder="Optional"
              rows={2}
              disabled={locked}
              defaultValue={member?.address ?? undefined}
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
              <Button key="save" type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Save team member"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamMemberRowActions({
  entry,
  children,
}: {
  entry: TeamMemberEntry;
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
            <TeamActionsMenu onEdit={openEdit} onDelete={() => setDeleteOpen(true)} />
          </div>
        </TableCell>
      </TableRow>
      <TeamMemberDialog
        member={entry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locked={locked}
        onUnlock={() => setLocked(false)}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`team member ${entry.name}`}
        onDelete={deleteTeamMember.bind(null, entry.id)}
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
