"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { markInvoicePaid } from "@/actions/invoices/actions";

export function MarkPaidDialog({
  open,
  onOpenChange,
  invoiceId,
  currency,
  suggestedPkrAmount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  currency: PaymentCurrency;
  suggestedPkrAmount?: number;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [addToEarning, setAddToEarning] = React.useState(true);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await markInvoicePaid(invoiceId, formData);
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
        if (!next) setAddToEarning(true);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark invoice as paid</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-3">
          <Field label="Transaction ID">
            <Input name="transactionId" placeholder="TID" required />
          </Field>
          <Field label="Paid on">
            <DatePicker
              name="paidOn"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 ring-1 ring-foreground/10">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Add to earning</span>
              <span className="text-xs text-muted-foreground">
                {addToEarning
                  ? "The money has reached the PKR account."
                  : "Not transferred yet — add it to earning later from the invoice's actions."}
              </span>
            </div>
            <Switch checked={addToEarning} onCheckedChange={setAddToEarning} />
            <input
              type="hidden"
              name="addToEarning"
              value={addToEarning ? "true" : "false"}
            />
          </div>
          {addToEarning && currency !== "PKR" && (
            <PkrAmountField
              currency={currency}
              suggestedPkrAmount={suggestedPkrAmount}
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {pending ? "Saving…" : "Mark as paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PkrAmountField({
  currency,
  suggestedPkrAmount,
}: {
  currency: PaymentCurrency;
  suggestedPkrAmount?: number;
}) {
  return (
    <Field label={`Amount received in PKR (invoice is in ${currency})`}>
      <Input
        type="number"
        name="pkrAmount"
        min="0"
        step="0.01"
        placeholder="0.00"
        defaultValue={suggestedPkrAmount?.toFixed(2)}
        required
      />
      {suggestedPkrAmount !== undefined && (
        <span className="text-xs text-muted-foreground">
          Estimated at today&apos;s FX rate — adjust if the actual amount
          received differs.
        </span>
      )}
    </Field>
  );
}

export function Field({
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
