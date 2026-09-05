"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  type ContractPaymentType,
  type ContractStatus,
  type MilestoneInput,
} from "@/lib/contracts/constants";
import {
  createContract,
  deleteContract,
  updateContract,
} from "@/actions/contracts/actions";
import { ContractActionsMenu } from "@/components/contracts/contract-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type ClientOption = {
  id: string;
  name: string;
  currency: PaymentCurrency;
};

export type ContractEntry = {
  id: string;
  clientId: string;
  date: Date;
  deadline: Date;
  projectName: string;
  description: string | null;
  currency: PaymentCurrency;
  paymentType: ContractPaymentType;
  amount: number | null;
  status: ContractStatus;
  milestones: { name: string; amount: number; deadline: Date }[];
};

type MilestoneRow = { name: string; amount: string; deadline: string };

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function emptyMilestoneRow(): MilestoneRow {
  return { name: "", amount: "", deadline: "" };
}

export function ContractDialog({
  contract,
  clients,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  contract?: ContractEntry;
  clients: ClientOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!contract;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [clientId, setClientId] = React.useState(contract?.clientId ?? "");
  const [currency, setCurrency] = React.useState<PaymentCurrency | "">(
    contract?.currency ?? "",
  );
  const [paymentType, setPaymentType] = React.useState<ContractPaymentType>(
    contract?.paymentType ?? "PROJECT",
  );
  const [milestones, setMilestones] = React.useState<MilestoneRow[]>(
    contract?.milestones.length
      ? contract.milestones.map((m) => ({
          name: m.name,
          amount: String(m.amount),
          deadline: toDateInputValue(m.deadline),
        }))
      : [emptyMilestoneRow()],
  );

  function resetForm() {
    setClientId("");
    setCurrency("");
    setPaymentType("PROJECT");
    setMilestones([emptyMilestoneRow()]);
  }

  function onClientChange(id: string | null) {
    setClientId(id ?? "");
    const client = clients.find((c) => c.id === id);
    if (client) setCurrency(client.currency);
  }

  function updateMilestone(index: number, patch: Partial<MilestoneRow>) {
    setMilestones((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addMilestone() {
    setMilestones((rows) => [...rows, emptyMilestoneRow()]);
  }

  function removeMilestone(index: number) {
    setMilestones((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  function onSubmit(formData: FormData) {
    setError(null);
    const milestoneInputs: MilestoneInput[] = milestones.map((m) => ({
      name: m.name.trim(),
      amount: Number(m.amount),
      deadline: m.deadline,
    }));

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateContract(contract.id, formData, milestoneInputs);
        } else {
          await createContract(formData, milestoneInputs);
          formRef.current?.reset();
          resetForm();
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
          Add contract
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contract" : "Add contract"}</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          action={onSubmit}
          className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1"
        >
          <Field label="Client">
            <Select name="clientId" value={clientId} onValueChange={onClientChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Project name">
            <Input
              name="projectName"
              placeholder="Project name"
              required
              defaultValue={contract?.projectName}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input
                type="date"
                name="date"
                required
                defaultValue={contract ? toDateInputValue(contract.date) : todayInput()}
              />
            </Field>
            <Field label="Deadline">
              <Input
                type="date"
                name="deadline"
                required
                defaultValue={contract ? toDateInputValue(contract.deadline) : undefined}
              />
            </Field>
          </div>

          <Field label="Description / note">
            <Textarea
              name="description"
              placeholder="Optional"
              rows={2}
              defaultValue={contract?.description ?? undefined}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              <Select
                name="currency"
                value={currency}
                onValueChange={(v) => setCurrency(v as PaymentCurrency)}
              >
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
              <Select name="status" defaultValue={contract?.status ?? "PROPOSED"}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CONTRACT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Payment structure">
            <Select
              name="paymentType"
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as ContractPaymentType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PAYMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {paymentType === "PROJECT" ? (
            <Field label="Amount">
              <Input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
                defaultValue={contract?.amount ?? undefined}
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Milestones</span>
              {milestones.map((row, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Input
                    placeholder="Name"
                    className="flex-1"
                    value={row.name}
                    onChange={(e) => updateMilestone(index, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    className="w-28"
                    value={row.amount}
                    onChange={(e) => updateMilestone(index, { amount: e.target.value })}
                  />
                  <Input
                    type="date"
                    className="w-40"
                    value={row.deadline}
                    onChange={(e) => updateMilestone(index, { deadline: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove milestone"
                    disabled={milestones.length === 1}
                    onClick={() => removeMilestone(index)}
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addMilestone}>
                <PlusIcon />
                Add milestone
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save contract"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContractRowActions({
  entry,
  clients,
}: {
  entry: ContractEntry;
  clients: ClientOption[];
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <ContractActionsMenu onEdit={() => setEditOpen(true)} onDelete={() => setDeleteOpen(true)} />
      <ContractDialog
        contract={entry}
        clients={clients}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`contract ${entry.projectName}`}
        onDelete={deleteContract.bind(null, entry.id)}
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
