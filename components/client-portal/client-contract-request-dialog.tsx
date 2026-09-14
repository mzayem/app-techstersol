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
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentCurrency } from "@/lib/clients/constants";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  type ContractPaymentType,
  type MilestoneInput,
} from "@/lib/contracts/constants";
import { createClientContractRequest } from "@/actions/client-portal/actions";

type MilestoneRow = { name: string; amount: string; deadline: string };

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function emptyMilestoneRow(): MilestoneRow {
  return { name: "", amount: "", deadline: "" };
}

/** A client's own "request a new project" form — deliberately a separate,
 * lighter component from the dashboard's ContractDialog rather than a mode
 * on it: Currency, Status, and "Handled by" aren't just disabled here,
 * they're absent from the DOM entirely, since the server locks them to
 * PROPOSED/the chosen profile's own currency regardless of input. Client
 * is auto-selected and locked when there's only one linked profile; with
 * several, the client genuinely has to say which one this is for. */
export function ClientContractRequestDialog({
  profiles,
}: {
  profiles: { id: string; name: string; currency: PaymentCurrency }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [paymentType, setPaymentType] =
    React.useState<ContractPaymentType>("PROJECT");
  const [milestones, setMilestones] = React.useState<MilestoneRow[]>([
    emptyMilestoneRow(),
  ]);
  const [profileId, setProfileId] = React.useState(profiles[0]?.id ?? "");
  const selectedProfile = profiles.find((p) => p.id === profileId);

  function resetForm() {
    setPaymentType("PROJECT");
    setMilestones([emptyMilestoneRow()]);
    setProfileId(profiles[0]?.id ?? "");
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

    startTransition(async () => {
      try {
        await createClientContractRequest(formData, milestoneInputs);
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
        Request new project
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a new project</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
            {profiles.length > 1 ? (
              <Field label="Which profile is this for?">
                <Select
                  value={profileId}
                  onValueChange={(v) => setProfileId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfile && (
                  <span className="text-xs text-muted-foreground">
                    Billed in {selectedProfile.currency}
                  </span>
                )}
                <input type="hidden" name="clientId" value={profileId} />
              </Field>
            ) : (
              <input type="hidden" name="clientId" value={profileId} />
            )}

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
              <Textarea
                name="description"
                placeholder="Tell us about the project"
                rows={3}
              />
            </Field>

            <Field label="Payment structure">
              <Select
                name="paymentType"
                value={paymentType}
                onValueChange={(v) =>
                  setPaymentType((v ?? "PROJECT") as ContractPaymentType)
                }
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
                <span className="text-sm text-muted-foreground">
                  Milestones
                </span>
                {milestones.map((row, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Input
                      placeholder="Name"
                      className="flex-1"
                      value={row.name}
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
                      onChange={(e) =>
                        updateMilestone(index, { amount: e.target.value })
                      }
                    />
                    <DatePicker
                      className="w-40"
                      value={row.deadline}
                      onValueChange={(v) =>
                        updateMilestone(index, { deadline: v })
                      }
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMilestone}
                >
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
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {pending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
