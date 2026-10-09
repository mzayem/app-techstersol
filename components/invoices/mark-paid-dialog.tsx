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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import type { FeeInput } from "@/lib/invoices/fees";
import { markInvoicePaid } from "@/actions/invoices/actions";

type FeeRow = { label: string; mode: FeeInput["mode"]; value: string };

function emptyFee(): FeeRow {
  return { label: "", mode: "amount", value: "" };
}

/** A fee line's amount in the invoice currency — the server resolves it
 * the same way (see lib/invoices/fees.ts). */
function feeAmount(row: FeeRow, balanceDue: number) {
  const value = Number(row.value) || 0;
  return row.mode === "percent" ? (balanceDue * value) / 100 : value;
}

export function MarkPaidDialog({
  open,
  onOpenChange,
  invoiceId,
  currency,
  balanceDue,
  suggestedPkrAmount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  currency: PaymentCurrency;
  balanceDue: number;
  suggestedPkrAmount?: number;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [addToEarning, setAddToEarning] = React.useState(true);
  const [feesEnabled, setFeesEnabled] = React.useState(false);
  const [fees, setFees] = React.useState<FeeRow[]>([emptyFee()]);
  // The PKR field follows the fees until it's edited by hand.
  const [pkrAmount, setPkrAmount] = React.useState<string | null>(null);

  const feesTotal = feesEnabled
    ? fees.reduce((sum, row) => sum + feeAmount(row, balanceDue), 0)
    : 0;
  const netAmount = balanceDue - feesTotal;
  const suggestedNetPkr =
    suggestedPkrAmount !== undefined && balanceDue > 0
      ? (suggestedPkrAmount * netAmount) / balanceDue
      : undefined;

  function reset() {
    setAddToEarning(true);
    setFeesEnabled(false);
    setFees([emptyFee()]);
    setPkrAmount(null);
    setError(null);
  }

  function updateFee(index: number, patch: Partial<FeeRow>) {
    setFees((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await markInvoicePaid(invoiceId, formData);
        onOpenChange(false);
        reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const feeInputs: FeeInput[] = feesEnabled
    ? fees
        .filter((row) => row.label.trim() || row.value)
        .map((row) => ({
          label: row.label,
          mode: row.mode,
          value: Number(row.value),
        }))
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
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

          <div className="flex flex-col gap-2 rounded-md px-3 py-2.5 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  Fees or taxes deducted
                </span>
                <span className="text-xs text-muted-foreground">
                  Platform commission, withdrawal fee, tax… taken out before the
                  money reached you.
                </span>
              </div>
              <Switch checked={feesEnabled} onCheckedChange={setFeesEnabled} />
            </div>

            {feesEnabled && (
              <>
                {fees.map((row, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Input
                      placeholder="e.g. Upwork fee"
                      className="flex-1"
                      value={row.label}
                      onChange={(e) =>
                        updateFee(index, { label: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      className="w-20"
                      value={row.value}
                      onChange={(e) =>
                        updateFee(index, { value: e.target.value })
                      }
                    />
                    <Select
                      value={row.mode}
                      onValueChange={(v) =>
                        updateFee(index, {
                          mode: (v ?? "amount") as FeeRow["mode"],
                        })
                      }
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">{currency}</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove fee"
                      disabled={fees.length === 1}
                      onClick={() =>
                        setFees((rows) => rows.filter((_, i) => i !== index))
                      }
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFees((rows) => [...rows, emptyFee()])}
                  >
                    <PlusIcon />
                    Add fee
                  </Button>
                  <span className="text-right text-xs text-muted-foreground">
                    {formatContractAmount(balanceDue, currency)} −{" "}
                    {formatContractAmount(feesTotal, currency)} fees ={" "}
                    <span className="font-medium text-foreground">
                      {formatContractAmount(netAmount, currency)} received
                    </span>
                  </span>
                </div>
              </>
            )}
            <input
              type="hidden"
              name="fees"
              value={feeInputs.length ? JSON.stringify(feeInputs) : ""}
            />
          </div>

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
              suggestedPkrAmount={suggestedNetPkr}
              value={pkrAmount ?? suggestedNetPkr?.toFixed(2) ?? ""}
              onValueChange={setPkrAmount}
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

/** Amount actually received in PKR — after any fees. Controlled when
 * `value` is given (the mark-paid dialog keeps it in step with the fees). */
export function PkrAmountField({
  currency,
  suggestedPkrAmount,
  value,
  onValueChange,
}: {
  currency: PaymentCurrency;
  suggestedPkrAmount?: number;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <Field label={`Amount received in PKR (invoice is in ${currency})`}>
      <Input
        type="number"
        name="pkrAmount"
        min="0"
        step="0.01"
        placeholder="0.00"
        {...(value !== undefined
          ? {
              value,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                onValueChange?.(e.target.value),
            }
          : { defaultValue: suggestedPkrAmount?.toFixed(2) })}
        required
      />
      {suggestedPkrAmount !== undefined && (
        <span className="text-xs text-muted-foreground">
          What actually reached your account, after any fees — estimated at
          today&apos;s FX rate, adjust if it differs.
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
