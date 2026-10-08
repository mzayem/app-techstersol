"use client";

import * as React from "react";
import { PlusIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/toast";
import {
  BILLING_CYCLE_LABELS,
  formatContractAmount,
  type BillingCycle,
} from "@/lib/contracts/constants";
import { formatPeriod } from "@/lib/contracts/billing";
import {
  addContractHourLog,
  deleteContractHourLog,
  invoiceContractHours,
  listContractHourLogs,
  type HourLogRow,
} from "@/actions/contracts/hours";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

/** An HOURLY contract's logged hours: log hours per week/month, then bill
 * every unbilled hour as one invoice (emailed to the client). Talks to the
 * server directly, like the project expenses section. */
export function HourLogDialog({
  open,
  onOpenChange,
  contract,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: {
    id: string;
    projectName: string;
    currency: string;
    amount: number | null;
    billingCycle: BillingCycle | null;
  };
  canEdit: boolean;
}) {
  const [logs, setLogs] = React.useState<HourLogRow[] | null>(null);
  const [date, setDate] = React.useState(todayInput());
  const [hours, setHours] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const rate = contract.amount ?? 0;
  const cycle = contract.billingCycle ?? "WEEKLY";
  const unbilled = (logs ?? []).filter((l) => !l.invoice);
  const unbilledHours = unbilled.reduce((sum, l) => sum + l.hours, 0);

  const load = React.useCallback(() => {
    listContractHourLogs(contract.id)
      .then(setLogs)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Couldn't load hours"),
      );
  }, [contract.id]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function addLog() {
    const formData = new FormData();
    formData.set("periodDate", date);
    formData.set("hours", hours);
    formData.set("note", note);
    run(async () => {
      await addContractHourLog(contract.id, formData);
      setHours("");
      setNote("");
    });
  }

  function createInvoice() {
    run(async () => {
      const { invoiceNumber } = await invoiceContractHours(contract.id);
      toast.add({
        title: `Invoice ${invoiceNumber} created and emailed to the client`,
        type: "success",
      });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Hours — {contract.projectName}</DialogTitle>
          <DialogDescription>
            {formatContractAmount(rate, contract.currency)} / hour, invoiced{" "}
            {BILLING_CYCLE_LABELS[cycle].toLowerCase()}. Hours are logged
            against the {cycle === "WEEKLY" ? "week (Mon–Sun)" : "month"}{" "}
            containing the date you pick.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {logs === null && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          )}
          {logs?.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hours logged yet.
            </p>
          )}
          {logs?.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-2 border-b py-1.5 text-sm last:border-0"
            >
              <div className="flex flex-1 flex-col">
                <span>{formatPeriod(log.periodStart, log.periodEnd)}</span>
                {log.note && (
                  <span className="text-xs text-muted-foreground">
                    {log.note}
                  </span>
                )}
              </div>
              <span className="w-16 text-right tabular-nums">
                {log.hours} h
              </span>
              <span className="w-24 text-right tabular-nums">
                {formatContractAmount(log.hours * rate, contract.currency)}
              </span>
              <span className="w-28 text-right text-xs text-muted-foreground">
                {log.invoice
                  ? `#${log.invoice.number} · ${log.invoice.status === "PAID" ? "paid" : "unpaid"}`
                  : "Not invoiced"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove hours"
                disabled={!canEdit || pending || !!log.invoice}
                onClick={() => run(() => deleteContractHourLog(log.id))}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-start gap-2">
            <DatePicker className="w-36" value={date} onValueChange={setDate} />
            <Input
              type="number"
              min="0"
              step="0.25"
              placeholder="Hours"
              className="w-24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
            <Input
              placeholder="Note (optional)"
              className="min-w-32 flex-1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !hours || !date}
              onClick={addLog}
            >
              <PlusIcon />
              Log hours
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {canEdit && (
          <DialogFooter>
            <Button
              type="button"
              disabled={pending || unbilledHours <= 0}
              loading={pending}
              onClick={createInvoice}
            >
              <ReceiptTextIcon />
              {unbilledHours > 0
                ? `Invoice ${unbilledHours} unbilled h (${formatContractAmount(unbilledHours * rate, contract.currency)})`
                : "No unbilled hours"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
