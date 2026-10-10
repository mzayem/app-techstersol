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
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
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
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  BILLING_CYCLE_UNITS,
  PROJECT_STATUSES,
  HOURLY_BILLING_CYCLES,
  PAYMENT_TYPE_LABELS,
  PROJECT_PAYMENT_TYPES,
  RECURRING_CREATE_STATUSES,
  RECURRING_STATUSES,
  WORK_COST_MODES,
  WORK_COST_MODE_LABELS,
  contractRevenueBasis,
  contractStatusLabel,
  isOpenEnded,
  type BillingCycle,
  type ContractPaymentType,
  type ContractStatus,
  type ContractWorkCostMode,
  type MilestoneInput,
} from "@/lib/contracts/constants";
import { enqueueMutation } from "@/lib/sync/mutate";
import { formDataToRecord } from "@/lib/sync/actions-registry";
import { TableCell, TableRow } from "@/components/ui/table";
import { ContractActionsMenu } from "@/components/contracts/contract-actions-menu";
import { ContractChatButton } from "@/components/contracts/contract-chat";
import { SendEmailDialog } from "@/components/mail/send-email-dialog";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";
import {
  ProjectExpensesSection,
  type ProjectExpenseRow,
} from "@/components/contracts/project-expenses-section";
import { HourLogDialog } from "@/components/contracts/hour-log-dialog";
import { formatContractNumber } from "@/lib/contracts/numbering-format";
import { getFxEstimate } from "@/actions/contracts/actions";

export type ClientOption = {
  id: string;
  name: string;
  currency: PaymentCurrency;
  emailNotificationsEnabled: boolean;
};

export type TeamMemberOption = { id: string; name: string };

export type PartnerOption = {
  id: string;
  name: string;
  sharePercentage: number;
  currency: PaymentCurrency;
};

export type BankAccountOption = {
  id: string;
  currency: PaymentCurrency;
  bankName: string;
  accountHolderName: string;
};

/** "project": the Contracts page (fixed-price and hourly). "recurring": the
 * Recurring Contracts page — always paymentType RECURRING. */
export type ContractVariant = "project" | "recurring";

export type ContractEntry = {
  id: string;
  number: number;
  clientId: string;
  clientEmail: string;
  date: Date;
  deadline: Date | null;
  projectName: string;
  description: string | null;
  currency: PaymentCurrency;
  paymentType: ContractPaymentType;
  amount: number | null;
  status: ContractStatus;
  teamMemberId: string | null;
  teamPayAmount: number | null;
  statusEmailsEnabled: boolean;
  chatNotificationsEnabled: boolean;
  partnerId: string | null;
  workCostMode: ContractWorkCostMode | null;
  workCostPercent: number | null;
  partnerSharePercent: number | null;
  billingCycle: BillingCycle | null;
  bankAccountId: string | null;
  invoiceDueDays: number;
  terms: string | null;
  nextInvoiceDate: Date | null;
  /** HOURLY only — logged hours not yet on an invoice. */
  unbilledHours: number;
  milestones: { name: string; amount: number; deadline: Date }[];
  projectExpenses: ProjectExpenseRow[];
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
  teamMembers,
  partners,
  bankAccounts,
  variant = "project",
  open: openProp,
  onOpenChange: onOpenChangeProp,
  locked = false,
  onUnlock,
  canEdit = true,
}: {
  contract?: ContractEntry;
  clients: ClientOption[];
  teamMembers: TeamMemberOption[];
  partners: PartnerOption[];
  bankAccounts: BankAccountOption[];
  variant?: ContractVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
  /** Whether the viewer is allowed to unlock this dialog at all — a
   * view-only role never gets the "Update" button, not even disabled. */
  canEdit?: boolean;
}) {
  const isEdit = !!contract;
  const isRecurringPage = variant === "recurring";
  const defaultPaymentType: ContractPaymentType = isRecurringPage
    ? "RECURRING"
    : "PROJECT";
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
  const [paymentType, setPaymentType] = React.useState<
    ContractPaymentType | ""
  >(contract?.paymentType ?? defaultPaymentType);
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle | "">(
    contract?.billingCycle ?? "MONTHLY",
  );
  const [bankAccountId, setBankAccountId] = React.useState(
    contract?.bankAccountId ?? "",
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
  const [handledBy, setHandledBy] = React.useState<"company" | "outsourced">(
    contract?.teamMemberId ? "outsourced" : "company",
  );
  const [teamMemberId, setTeamMemberId] = React.useState(
    contract?.teamMemberId ?? "",
  );
  const [statusEmailsEnabled, setStatusEmailsEnabled] = React.useState(
    contract?.statusEmailsEnabled ?? true,
  );
  const [chatNotificationsEnabled, setChatNotificationsEnabled] =
    React.useState(contract?.chatNotificationsEnabled ?? false);

  // Controlled so the percentage-mode work cost estimate can recompute live
  // off the same values the admin is typing.
  const [amount, setAmount] = React.useState(
    contract?.amount != null ? String(contract.amount) : "",
  );
  const [teamPayAmount, setTeamPayAmount] = React.useState(
    contract?.teamPayAmount != null ? String(contract.teamPayAmount) : "",
  );
  const [partnerEnabled, setPartnerEnabled] = React.useState(
    !!contract?.partnerId,
  );
  const [partnerId, setPartnerId] = React.useState(contract?.partnerId ?? "");
  const [partnerSharePercent, setPartnerSharePercent] = React.useState(
    contract?.partnerSharePercent != null
      ? String(contract.partnerSharePercent)
      : "",
  );
  const [workCostMode, setWorkCostMode] = React.useState<ContractWorkCostMode>(
    contract?.workCostMode ?? "FIXED",
  );
  const [workCostPercent, setWorkCostPercent] = React.useState(
    contract?.workCostPercent != null ? String(contract.workCostPercent) : "",
  );
  const [fxRates, setFxRates] = React.useState<Record<
    PaymentCurrency,
    number
  > | null>(null);

  const selectedClient = clients.find((c) => c.id === clientId);
  const clientNotificationsDisabled = selectedClient
    ? !selectedClient.emailNotificationsEnabled
    : false;

  // Fetched once when the dialog is opened — used only to preview the
  // percentage-mode work cost in PKR; the admin can still edit the result.
  React.useEffect(() => {
    if (!open || fxRates) return;
    getFxEstimate()
      .then(setFxRates)
      .catch(() => {});
  }, [open, fxRates]);

  // Recomputes the "estimated work cost (PKR)" field whenever revenue,
  // currency, or the percentage itself changes — the admin can still
  // hand-edit the result afterward without it snapping back, since this
  // effect only re-runs when one of these specific inputs changes again.
  React.useEffect(() => {
    if (!partnerEnabled || workCostMode !== "PERCENTAGE") return;
    const pct = Number(workCostPercent);
    if (!workCostPercent || Number.isNaN(pct)) return;

    const revenue = contractRevenueBasis({
      paymentType: (paymentType || "PROJECT") as ContractPaymentType,
      amount: paymentType !== "MILESTONE" ? Number(amount) : null,
      milestones: milestones.map((m) => ({ amount: Number(m.amount) || 0 })),
    });
    const rate =
      currency && currency !== "PKR" ? (fxRates?.[currency] ?? 1) : 1;
    const estimate = (revenue * rate * pct) / 100;
    setTeamPayAmount(estimate ? estimate.toFixed(2) : "0.00");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- milestones is an array literal each render; JSON-stringify below keys the effect off its actual contents instead.
  }, [
    partnerEnabled,
    workCostMode,
    workCostPercent,
    paymentType,
    amount,
    currency,
    fxRates,
    JSON.stringify(milestones.map((m) => m.amount)),
  ]);

  function onPartnerChange(id: string | null) {
    setPartnerId(id ?? "");
    const partner = partners.find((p) => p.id === id);
    if (partner) setPartnerSharePercent(String(partner.sharePercentage));
  }

  function resetForm() {
    setClientId("");
    setCurrency("");
    setPaymentType(defaultPaymentType);
    setBillingCycle("MONTHLY");
    setBankAccountId("");
    setMilestones([emptyMilestoneRow()]);
    setHandledBy("company");
    setTeamMemberId("");
    setStatusEmailsEnabled(true);
    setChatNotificationsEnabled(false);
    setAmount("");
    setTeamPayAmount("");
    setPartnerEnabled(false);
    setPartnerId("");
    setPartnerSharePercent("");
    setWorkCostMode("FIXED");
    setWorkCostPercent("");
  }

  function onClientChange(id: string | null) {
    setClientId(id ?? "");
    const client = clients.find((c) => c.id === id);
    if (client) onCurrencyChange(client.currency);
  }

  // Keeps the invoice bank account in step with the contract currency —
  // invoices can only be paid into an account in their own currency.
  function onCurrencyChange(next: PaymentCurrency | "") {
    setCurrency(next);
    const current = bankAccounts.find((b) => b.id === bankAccountId);
    if (!current || current.currency !== next) {
      setBankAccountId(bankAccounts.find((b) => b.currency === next)?.id ?? "");
    }
  }

  function onPaymentTypeChange(next: ContractPaymentType | "") {
    setPaymentType(next);
    // Hourly work is only ever evaluated weekly or monthly.
    if (
      next === "HOURLY" &&
      !(HOURLY_BILLING_CYCLES as readonly string[]).includes(billingCycle)
    ) {
      setBillingCycle("WEEKLY");
    }
    if (next && isOpenEnded(next) && !bankAccountId && currency) {
      setBankAccountId(
        bankAccounts.find((b) => b.currency === currency)?.id ?? "",
      );
    }
  }

  function updateMilestone(index: number, patch: Partial<MilestoneRow>) {
    setMilestones((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addMilestone() {
    setMilestones((rows) => [...rows, emptyMilestoneRow()]);
  }

  function removeMilestone(index: number) {
    setMilestones((rows) =>
      rows.length > 1 ? rows.filter((_, i) => i !== index) : rows,
    );
  }

  function onSubmit(formData: FormData) {
    setError(null);
    const milestoneInputs: MilestoneInput[] = milestones.map((m) => ({
      name: m.name.trim(),
      amount: Number(m.amount),
      deadline: m.deadline,
    }));
    const fields = formDataToRecord(formData);
    const label = `contract "${fields.projectName}"`;

    startTransition(async () => {
      const result = isEdit
        ? await enqueueMutation({
            key: "updateContract",
            payload: {
              id: contract.id,
              formData: fields,
              milestones: milestoneInputs,
            },
            label,
          })
        : await enqueueMutation({
            key: "createContract",
            payload: { formData: fields, milestones: milestoneInputs },
            label,
          });
      if (result.ok) {
        if (!isEdit) {
          formRef.current?.reset();
          resetForm();
        }
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  const openEnded = !!paymentType && isOpenEnded(paymentType);
  const unit =
    paymentType === "HOURLY"
      ? "hour"
      : paymentType === "RECURRING" && billingCycle
        ? BILLING_CYCLE_UNITS[billingCycle]
        : null;
  // A new recurring contract is paid in advance: it starts as a Draft or
  // goes straight to awaiting its advance (which invoices the first period).
  const statusOptions: readonly ContractStatus[] = isRecurringPage
    ? isEdit
      ? RECURRING_STATUSES
      : RECURRING_CREATE_STATUSES
    : PROJECT_STATUSES;
  const cycleOptions: readonly BillingCycle[] =
    paymentType === "HOURLY" ? HOURLY_BILLING_CYCLES : BILLING_CYCLES;
  const accountOptions = bankAccounts.filter(
    (b) => !currency || b.currency === currency,
  );
  const noun = isRecurringPage ? "recurring contract" : "contract";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Add {noun}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Edit ${noun} ${formatContractNumber(contract.number)}`
              : `Add ${noun}`}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
            <Field label="Client">
              <Combobox
                value={clientId}
                onValueChange={onClientChange}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select client"
                searchPlaceholder="Search clients…"
                emptyText="No clients found."
                disabled={locked}
              />
              <input type="hidden" name="clientId" value={clientId} />
            </Field>

            <Field label={isRecurringPage ? "Service name" : "Project name"}>
              <Input
                name="projectName"
                placeholder={
                  isRecurringPage ? "e.g. Website maintenance" : "Project name"
                }
                required
                disabled={locked}
                defaultValue={contract?.projectName}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <DatePicker
                  name="date"
                  required
                  disabled={locked}
                  defaultValue={
                    contract ? toDateInputValue(contract.date) : todayInput()
                  }
                />
              </Field>
              <Field label={openEnded ? "End date (optional)" : "Deadline"}>
                <DatePicker
                  name="deadline"
                  required={!openEnded}
                  disabled={locked}
                  defaultValue={
                    contract?.deadline
                      ? toDateInputValue(contract.deadline)
                      : undefined
                  }
                />
              </Field>
            </div>

            <Field label="Description / note">
              <Textarea
                name="description"
                placeholder="Optional"
                rows={2}
                disabled={locked}
                defaultValue={contract?.description ?? undefined}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency">
                <Select
                  name="currency"
                  value={currency}
                  onValueChange={(v) =>
                    onCurrencyChange((v ?? "") as PaymentCurrency | "")
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
              <Field label="Status">
                <Select
                  name="status"
                  defaultValue={contract?.status ?? "PROPOSED"}
                  disabled={locked}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Status</SelectItem>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {contractStatusLabel(s, defaultPaymentType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {isRecurringPage ? (
              <input type="hidden" name="paymentType" value="RECURRING" />
            ) : (
              <Field label="Payment structure">
                <Select
                  name="paymentType"
                  value={paymentType}
                  onValueChange={(v) =>
                    onPaymentTypeChange((v ?? "") as ContractPaymentType | "")
                  }
                  disabled={locked}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Payment structure</SelectItem>
                    {PROJECT_PAYMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PAYMENT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {openEnded && (
              <Field
                label={
                  paymentType === "HOURLY" ? "Hours invoiced" : "Billing cycle"
                }
              >
                <Select
                  name="billingCycle"
                  value={billingCycle}
                  onValueChange={(v) =>
                    setBillingCycle((v ?? "") as BillingCycle | "")
                  }
                  disabled={locked}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Billing cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {cycleOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {BILLING_CYCLE_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {paymentType === "MILESTONE" ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">
                  Milestones
                </span>
                {milestones.map((row, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Input
                      placeholder="Name"
                      className="flex-1"
                      value={row.name}
                      disabled={locked}
                      onChange={(e) =>
                        updateMilestone(index, { name: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      className="w-28"
                      value={row.amount}
                      disabled={locked}
                      onChange={(e) =>
                        updateMilestone(index, { amount: e.target.value })
                      }
                    />
                    <DatePicker
                      className="w-40"
                      value={row.deadline}
                      disabled={locked}
                      onValueChange={(v) =>
                        updateMilestone(index, { deadline: v })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove milestone"
                      disabled={locked || milestones.length === 1}
                      onClick={() => removeMilestone(index)}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={locked}
                  onClick={addMilestone}
                >
                  <PlusIcon />
                  Add milestone
                </Button>
              </div>
            ) : (
              <Field
                label={
                  paymentType === "HOURLY"
                    ? "Hourly rate"
                    : unit
                      ? `Amount per ${unit}`
                      : "Amount"
                }
              >
                <Input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                  disabled={locked}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            )}

            {openEnded && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoices paid into">
                  <Select
                    value={bankAccountId}
                    onValueChange={(v) => setBankAccountId(v ?? "")}
                    disabled={locked}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.length === 0 && (
                        <SelectItem value="" disabled>
                          {currency
                            ? `No ${currency} bank account`
                            : "Pick a currency first"}
                        </SelectItem>
                      )}
                      {accountOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bankName} — {b.accountHolderName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    name="bankAccountId"
                    value={bankAccountId}
                  />
                </Field>
                <Field label="Invoice due after (days)">
                  <Input
                    type="number"
                    name="invoiceDueDays"
                    min="0"
                    max="120"
                    step="1"
                    required
                    disabled={locked}
                    defaultValue={contract?.invoiceDueDays ?? 7}
                  />
                </Field>
              </div>
            )}

            {isRecurringPage && (
              <p className="text-xs text-muted-foreground">
                Billed in advance: an invoice for each{" "}
                {unit ?? "billing period"} is generated at the start of the
                period and emailed to the client automatically.
                {isEdit
                  ? " Draft, paused, cancelled and completed contracts are never invoiced."
                  : " Save as Awaiting advance payment to send the first invoice now — the contract turns Active once it's paid. Save as Draft to send nothing yet."}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Handled by</span>
              <div className="inline-flex w-fit overflow-hidden rounded-md ring-1 ring-input">
                <Button
                  type="button"
                  size="sm"
                  variant={handledBy === "company" ? "default" : "ghost"}
                  className="rounded-none"
                  disabled={locked}
                  onClick={() => {
                    setHandledBy("company");
                    setTeamMemberId("");
                  }}
                >
                  Company
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={handledBy === "outsourced" ? "default" : "ghost"}
                  className="rounded-none"
                  disabled={locked}
                  onClick={() => setHandledBy("outsourced")}
                >
                  Outsourced
                </Button>
              </div>
            </div>

            {handledBy === "outsourced" && (
              <Field label="Team member">
                <Combobox
                  value={teamMemberId}
                  onValueChange={setTeamMemberId}
                  options={teamMembers.map((m) => ({
                    value: m.id,
                    label: m.name,
                  }))}
                  placeholder="Select team member"
                  searchPlaceholder="Search team…"
                  emptyText="No team members found."
                  disabled={locked}
                />
                <input type="hidden" name="teamMemberId" value={teamMemberId} />
              </Field>
            )}

            <div className="flex items-center justify-between gap-3 rounded-md ring-1 ring-foreground/10 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Partner contract</span>
                <span className="text-xs text-muted-foreground">
                  Attach a profit-sharing partner to this project.
                </span>
              </div>
              <Switch
                checked={partnerEnabled}
                onCheckedChange={(checked) => {
                  setPartnerEnabled(checked);
                  if (!checked) {
                    setPartnerId("");
                    setPartnerSharePercent("");
                  }
                }}
                disabled={locked}
              />
            </div>

            {partnerEnabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Partner">
                    <Combobox
                      value={partnerId}
                      onValueChange={onPartnerChange}
                      options={partners.map((p) => ({
                        value: p.id,
                        label: p.name,
                      }))}
                      placeholder="Select partner"
                      searchPlaceholder="Search partners…"
                      emptyText="No partners found."
                      disabled={locked}
                    />
                    <input type="hidden" name="partnerId" value={partnerId} />
                  </Field>
                  <Field label="Partner share %">
                    <Input
                      type="number"
                      name="partnerSharePercent"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0.00"
                      disabled={locked}
                      value={partnerSharePercent}
                      onChange={(e) => setPartnerSharePercent(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">
                    Work cost
                  </span>
                  <div className="inline-flex w-fit overflow-hidden rounded-md ring-1 ring-input">
                    {WORK_COST_MODES.map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        size="sm"
                        variant={workCostMode === mode ? "default" : "ghost"}
                        className="rounded-none"
                        disabled={locked}
                        onClick={() => setWorkCostMode(mode)}
                      >
                        {WORK_COST_MODE_LABELS[mode]}
                      </Button>
                    ))}
                  </div>
                </div>
                <input type="hidden" name="workCostMode" value={workCostMode} />

                {workCostMode === "PERCENTAGE" && (
                  <Field
                    label={
                      unit
                        ? `Work cost % of revenue per ${unit}`
                        : "Work cost % of revenue"
                    }
                  >
                    <Input
                      type="number"
                      name="workCostPercent"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0.00"
                      disabled={locked}
                      value={workCostPercent}
                      onChange={(e) => setWorkCostPercent(e.target.value)}
                    />
                  </Field>
                )}
              </>
            )}

            {(handledBy === "outsourced" || partnerEnabled) && (
              <Field
                label={
                  (partnerEnabled && workCostMode === "PERCENTAGE"
                    ? "Estimated work cost (PKR) — editable"
                    : "Work cost (PKR)") + (unit ? ` per ${unit}` : "")
                }
              >
                <Input
                  type="number"
                  name="teamPayAmount"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required={
                    handledBy === "outsourced" &&
                    !(partnerEnabled && workCostMode === "PERCENTAGE")
                  }
                  disabled={locked}
                  value={teamPayAmount}
                  onChange={(e) => setTeamPayAmount(e.target.value)}
                />
              </Field>
            )}

            {isRecurringPage && (
              <Field label="Terms (printed on the service agreement)">
                <Textarea
                  name="terms"
                  placeholder={
                    "Optional — one term per line, e.g.\nEither party may cancel with 30 days' written notice."
                  }
                  rows={3}
                  disabled={locked}
                  defaultValue={contract?.terms ?? undefined}
                />
              </Field>
            )}

            {isEdit ? (
              <ProjectExpensesSection
                contractId={contract.id}
                currency={contract.currency}
                initialExpenses={contract.projectExpenses}
                disabled={locked}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Save the contract first to add project expenses.
              </p>
            )}

            <div className="flex items-center justify-between gap-3 rounded-md ring-1 ring-foreground/10 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  Email on status changes
                </span>
                <span className="text-xs text-muted-foreground">
                  {clientNotificationsDisabled
                    ? "Off — this client has email notifications disabled in their profile."
                    : "Notify the client by email whenever this project's status changes."}
                </span>
              </div>
              <Switch
                checked={statusEmailsEnabled && !clientNotificationsDisabled}
                onCheckedChange={setStatusEmailsEnabled}
                disabled={locked || clientNotificationsDisabled}
              />
              {/* The project's own choice is kept while the client is
                  muted, so it takes effect again once they're unmuted. */}
              <input
                type="hidden"
                name="statusEmailsEnabled"
                value={statusEmailsEnabled ? "true" : "false"}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md ring-1 ring-foreground/10 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  Email client on new chat messages
                </span>
                <span className="text-xs text-muted-foreground">
                  {clientNotificationsDisabled
                    ? "Off — this client has email notifications disabled in their profile."
                    : "Off by default. When on, a message from you emails the client. Client messages always email the admin and the partner, plus any staff who turned on chat notifications in their profile."}
                </span>
              </div>
              <Switch
                checked={
                  chatNotificationsEnabled && !clientNotificationsDisabled
                }
                onCheckedChange={setChatNotificationsEnabled}
                disabled={locked || clientNotificationsDisabled}
              />
              <input
                type="hidden"
                name="chatNotificationsEnabled"
                value={chatNotificationsEnabled ? "true" : "false"}
              />
            </div>
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
                {pending ? "Saving…" : isEdit ? "Save changes" : `Save ${noun}`}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContractRowActions({
  entry,
  clients,
  teamMembers,
  partners,
  bankAccounts,
  variant = "project",
  children,
  selected,
  onRowClick,
  canEdit = true,
  canDelete = true,
}: {
  entry: ContractEntry;
  clients: ClientOption[];
  teamMembers: TeamMemberOption[];
  partners: PartnerOption[];
  bankAccounts: BankAccountOption[];
  variant?: ContractVariant;
  children: React.ReactNode;
  selected?: boolean;
  onRowClick?: (e: React.MouseEvent) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [locked, setLocked] = React.useState(true);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [hoursOpen, setHoursOpen] = React.useState(false);

  function openView() {
    setLocked(true);
    setDialogOpen(true);
  }

  function openEdit() {
    setLocked(false);
    setDialogOpen(true);
  }

  function handleRowClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onRowClick?.(e);
    } else {
      openView();
    }
  }

  return (
    <>
      <TableRow
        data-state={selected ? "selected" : undefined}
        className="cursor-pointer"
        onClick={handleRowClick}
      >
        {children}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <ContractChatButton
              contractId={entry.id}
              projectName={entry.projectName}
            />
            <SendEmailDialog
              defaultTo={entry.clientEmail}
              record={{ kind: "contract", id: entry.id }}
            />
            <ContractActionsMenu
              onEdit={openEdit}
              onDelete={() => setDeleteOpen(true)}
              onLogHours={
                entry.paymentType === "HOURLY"
                  ? () => setHoursOpen(true)
                  : undefined
              }
              agreementHref={
                isOpenEnded(entry.paymentType)
                  ? `/api/contracts/${entry.id}/agreement`
                  : undefined
              }
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </TableCell>
      </TableRow>
      <ContractDialog
        contract={entry}
        clients={clients}
        teamMembers={teamMembers}
        partners={partners}
        bankAccounts={bankAccounts}
        variant={variant}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locked={locked}
        onUnlock={() => setLocked(false)}
        canEdit={canEdit}
      />
      {entry.paymentType === "HOURLY" && (
        <HourLogDialog
          open={hoursOpen}
          onOpenChange={setHoursOpen}
          contract={entry}
          canEdit={canEdit}
        />
      )}
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`contract ${entry.projectName}`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deleteContract",
            payload: { id: entry.id },
            label: `contract "${entry.projectName}"`,
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
