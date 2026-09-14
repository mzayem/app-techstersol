"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PaymentCurrency } from "@/lib/clients/constants";
import {
  formatInvoiceNumber,
  type InvoiceStatus,
} from "@/lib/invoices/constants";
import { markInvoiceUnpaid } from "@/actions/invoices/actions";
import { enqueueMutation } from "@/lib/sync/mutate";
import { InvoiceActionsMenu } from "@/components/invoices/invoice-actions-menu";
import { MarkPaidDialog } from "@/components/invoices/mark-paid-dialog";
import { SendEmailDialog } from "@/components/mail/send-email-dialog";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";
import { toast } from "@/components/ui/toast";

export function InvoiceRowActions({
  id,
  number,
  status,
  currency,
  clientEmail,
  suggestedPkrAmount,
}: {
  id: string;
  number: number;
  status: InvoiceStatus;
  currency: PaymentCurrency;
  clientEmail: string;
  /** Balance due converted to PKR at the current FX rate — prefilled as a
   * default in the mark-paid dialog's PKR amount field, since the actual
   * amount received can differ (bank fees, rate at time of transfer). */
  suggestedPkrAmount?: number;
}) {
  const [markPaidOpen, setMarkPaidOpen] = React.useState(false);
  const [markUnpaidOpen, setMarkUnpaidOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirmMarkUnpaid() {
    startTransition(async () => {
      try {
        await markInvoiceUnpaid(id);
        setMarkUnpaidOpen(false);
      } catch (e) {
        toast.add({
          title: e instanceof Error ? e.message : "Couldn't mark this invoice as unpaid",
          type: "error",
        });
      }
    });
  }

  return (
    <>
      <InvoiceActionsMenu
        status={status}
        pdfHref={`/api/invoices/${id}/pdf`}
        onMarkPaid={() => setMarkPaidOpen(true)}
        onMarkUnpaid={() => setMarkUnpaidOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <SendEmailDialog defaultTo={clientEmail} record={{ kind: "invoice", id }} />
      <MarkPaidDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        invoiceId={id}
        currency={currency}
        suggestedPkrAmount={suggestedPkrAmount}
      />
      <AlertDialog
        open={markUnpaidOpen}
        onOpenChange={(next) => {
          if (!pending) setMarkUnpaidOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark {formatInvoiceNumber(number)} as unpaid?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This clears its transaction ID and paid date, deletes the earning
              entry it created, and moves its contract(s) back to pending
              payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline" disabled={pending} />}
            >
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              loading={pending}
              onClick={confirmMarkUnpaid}
            >
              {pending ? "Saving…" : "Mark as unpaid"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`invoice ${formatInvoiceNumber(number)}`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deleteInvoice",
            payload: { id },
            label: `invoice ${formatInvoiceNumber(number)}`,
          });
          if (!result.ok) throw new Error(result.error);
        }}
      />
    </>
  );
}
