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
        if (!pending) onOpenChange(next);
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
            <Input
              type="date"
              name="paidOn"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          {currency !== "PKR" && (
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
                  Estimated at today&apos;s FX rate — adjust if the actual
                  amount received differs.
                </span>
              )}
            </Field>
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
