"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

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
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/clients/countries";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  type ContractPaymentType,
  type MilestoneInput,
} from "@/lib/contracts/constants";
import { createPartnerClient, createPartnerContractRequest } from "@/actions/partner-portal/actions";
import type { PartnerClientOption } from "@/actions/partner-portal/queries";

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: c }));

type MilestoneRow = { name: string; amount: string; deadline: string };
type ClientMode = "existing" | "new";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function emptyMilestoneRow(): MilestoneRow {
  return { name: "", amount: "", deadline: "" };
}

/** A partner's self-service "propose a new project" flow — lets them either
 * pick a client they've already brought in, or bring in a brand new one on
 * the spot (created via createPartnerClient, always tagged to this partner
 * and always with phone/email visibility off for the admin to flip on
 * later), then submits the project itself via createPartnerContractRequest
 * — mirroring ClientContractRequestDialog's shape from the client portal.
 * The team member + work-cost fields are an optional suggestion only; the
 * admin reviews and can freely change both before activating the project. */
export function PartnerContractRequestDialog({
  clients,
  teamMembers,
}: {
  clients: PartnerClientOption[];
  teamMembers: { id: string; name: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [clientMode, setClientMode] = React.useState<ClientMode>(
    clients.length > 0 ? "existing" : "new",
  );
  const [existingClientId, setExistingClientId] = React.useState(clients[0]?.id ?? "");
  const [newClientName, setNewClientName] = React.useState("");
  const [newClientPhone, setNewClientPhone] = React.useState("");
  const [newClientEmail, setNewClientEmail] = React.useState("");
  const [newClientCountry, setNewClientCountry] = React.useState("");
  const [newClientCurrency, setNewClientCurrency] = React.useState<PaymentCurrency | "">("");

  const [paymentType, setPaymentType] = React.useState<ContractPaymentType>("PROJECT");
  const [milestones, setMilestones] = React.useState<MilestoneRow[]>([emptyMilestoneRow()]);
  const [teamMemberId, setTeamMemberId] = React.useState("");

  function resetForm() {
    setClientMode(clients.length > 0 ? "existing" : "new");
    setExistingClientId(clients[0]?.id ?? "");
    setNewClientName("");
    setNewClientPhone("");
    setNewClientEmail("");
    setNewClientCountry("");
    setNewClientCurrency("");
    setPaymentType("PROJECT");
    setMilestones([emptyMilestoneRow()]);
    setTeamMemberId("");
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
        let clientId = existingClientId;

        if (clientMode === "new") {
          if (!newClientName || !newClientPhone || !newClientEmail || !newClientCountry || !newClientCurrency) {
            throw new Error("Fill in every field for the new client");
          }
          const clientFormData = new FormData();
          clientFormData.set("name", newClientName);
          clientFormData.set("phone", newClientPhone);
          clientFormData.set("email", newClientEmail);
          clientFormData.set("country", newClientCountry);
          clientFormData.set("currency", newClientCurrency);
          const created = await createPartnerClient(clientFormData);
          clientId = created.id;
        }

        if (!clientId) {
          throw new Error("Select or create a client for this project");
        }
        formData.set("clientId", clientId);

        await createPartnerContractRequest(formData, milestoneInputs);
        formRef.current?.reset();
        resetForm();
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Propose a project
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Propose a new project</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Client</span>
              <div className="inline-flex w-fit overflow-hidden rounded-md ring-1 ring-input">
                <Button
                  type="button"
                  size="sm"
                  variant={clientMode === "existing" ? "default" : "ghost"}
                  className="rounded-none"
                  disabled={clients.length === 0}
                  onClick={() => setClientMode("existing")}
                >
                  Existing client
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={clientMode === "new" ? "default" : "ghost"}
                  className="rounded-none"
                  onClick={() => setClientMode("new")}
                >
                  New client
                </Button>
              </div>

              {clientMode === "existing" ? (
                clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t brought in any clients yet — switch to &quot;New client&quot;.
                  </p>
                ) : (
                  <Combobox
                    value={existingClientId}
                    onValueChange={setExistingClientId}
                    options={clients.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Select client"
                    searchPlaceholder="Search clients…"
                    emptyText="No clients found."
                  />
                )
              ) : (
                <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
                  <Input
                    placeholder="Client name"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="tel"
                      placeholder="Phone"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                    />
                  </div>
                  <Combobox
                    value={newClientCountry}
                    onValueChange={setNewClientCountry}
                    options={COUNTRY_OPTIONS}
                    placeholder="Select country"
                    searchPlaceholder="Search countries…"
                    emptyText="No countries found."
                  />
                  <Select
                    value={newClientCurrency}
                    onValueChange={(v) => setNewClientCurrency((v as PaymentCurrency) ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Payment currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Field label="Project name">
              <Input name="projectName" placeholder="Project name" required />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <DatePicker name="date" required defaultValue={todayInput()} />
              </Field>
              <Field label="Deadline">
                <DatePicker name="deadline" required />
              </Field>
            </div>

            <Field label="Description">
              <Textarea name="description" placeholder="Tell us about the project" rows={3} />
            </Field>

            <Field label="Payment structure">
              <Select
                name="paymentType"
                value={paymentType}
                onValueChange={(v) => setPaymentType((v ?? "PROJECT") as ContractPaymentType)}
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

            {paymentType === "MILESTONE" ? (
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
                    <DatePicker
                      className="w-40"
                      value={row.deadline}
                      onValueChange={(v) => updateMilestone(index, { deadline: v })}
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
            ) : (
              <Field label="Amount">
                <Input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </Field>
            )}

            <div className="flex flex-col gap-2 rounded-md ring-1 ring-foreground/10 p-3">
              <span className="text-sm font-medium">Suggest a team member (optional)</span>
              <p className="text-xs text-muted-foreground">
                Just a starting point — the admin can change or clear this before activating
                the project.
              </p>
              <Select value={teamMemberId} onValueChange={(v) => setTeamMemberId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No suggestion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No suggestion</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="teamMemberId" value={teamMemberId} />
              {teamMemberId && (
                <Field label="Suggested work cost (PKR)">
                  <Input
                    type="number"
                    name="suggestedWorkCost"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </Field>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {pending ? "Sending…" : "Send proposal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
