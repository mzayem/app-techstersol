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
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { enqueueMutation } from "@/lib/sync/mutate";
import { formDataToRecord } from "@/lib/sync/actions-registry";
import type { PartnerOption } from "@/components/partners/partner-investment-dialog";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatPkr(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Logs where a partner's invested balance went — a free-text category
 * rather than a project picker, since it isn't limited to projects (could
 * be Upwork connects, stocks, or anywhere else the partner's money was
 * put to use). */
export function PartnerInvestmentSpendDialog({
  partners,
  balances,
}: {
  partners: PartnerOption[];
  balances: { partnerId: string; available: number }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [partnerId, setPartnerId] = React.useState("");

  const available =
    balances.find((b) => b.partnerId === partnerId)?.available ?? null;

  function onSubmit(formData: FormData) {
    setError(null);
    const fields = formDataToRecord(formData);
    startTransition(async () => {
      const result = await enqueueMutation({
        key: "createPartnerInvestmentSpend",
        payload: fields,
        label: "partner investment spend",
      });
      if (result.ok) {
        formRef.current?.reset();
        setPartnerId("");
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <PlusIcon />
        Log spending
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Log investment spending</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <Field label="Partner">
            <Combobox
              value={partnerId}
              onValueChange={(id) => setPartnerId(id ?? "")}
              options={partners.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select partner"
              searchPlaceholder="Search partners…"
              emptyText="No partners found."
            />
            <input type="hidden" name="partnerId" value={partnerId} />
          </Field>

          {partnerId && (
            <p className="text-xs text-muted-foreground">
              Available balance:{" "}
              <span className="font-medium text-foreground">
                {formatPkr(available ?? 0)}
              </span>
            </p>
          )}

          <Field label="Spent on">
            <Input
              name="category"
              placeholder="e.g. Project hosting, Upwork connects, Stocks"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <DatePicker name="date" required defaultValue={todayInput()} />
            </Field>
            <Field label="Amount (PKR)">
              <Input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </Field>
          </div>

          <Field label="Note (optional)">
            <Textarea name="note" placeholder="Optional" rows={2} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!partnerId} loading={pending}>
              {pending ? "Saving…" : "Save spending"}
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
