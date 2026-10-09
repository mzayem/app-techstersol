"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import { addInvoiceEarning } from "@/actions/invoices/actions";
import { Field, PkrAmountField } from "@/components/invoices/mark-paid-dialog";

/** For a paid invoice that was marked paid without booking an Earning —
 * books it once the money has actually reached the PKR account. */
export function AddEarningDialog({
  open,
  onOpenChange,
  invoiceId,
  currency,
  balanceDue,
  feesAmount,
  suggestedPkrAmount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  currency: PaymentCurrency;
  balanceDue: number;
  /** Fees recorded when it was marked paid, in the invoice currency. */
  feesAmount: number;
  suggestedPkrAmount?: number;
}) {
  const netAmount = balanceDue - feesAmount;
  const suggestedNetPkr =
    suggestedPkrAmount !== undefined && balanceDue > 0
      ? (suggestedPkrAmount * netAmount) / balanceDue
      : undefined;

  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addInvoiceEarning(invoiceId, formData);
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
          <DialogTitle>Add to earning</DialogTitle>
          {currency === "PKR" ? (
            <DialogDescription>
              Books {formatContractAmount(netAmount, "PKR")} as earning
              {feesAmount > 0 &&
                ` (${formatContractAmount(balanceDue, "PKR")} less ${formatContractAmount(feesAmount, "PKR")} in fees)`}
              .
            </DialogDescription>
          ) : (
            feesAmount > 0 && (
              <DialogDescription>
                {formatContractAmount(feesAmount, currency)} in fees was
                deducted from this payment —{" "}
                {formatContractAmount(netAmount, currency)} was received.
              </DialogDescription>
            )
          )}
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-3">
          <Field label="Received in PKR account on">
            <DatePicker
              name="receivedOn"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          {currency !== "PKR" && (
            <PkrAmountField
              currency={currency}
              suggestedPkrAmount={suggestedNetPkr}
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {pending ? "Saving…" : "Add to earning"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
