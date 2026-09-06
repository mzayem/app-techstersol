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
import { deleteInvoice, markInvoiceUnpaid } from "@/actions/invoices/actions";
import { InvoiceActionsMenu } from "@/components/invoices/invoice-actions-menu";
import { MarkPaidDialog } from "@/components/invoices/mark-paid-dialog";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export function InvoiceRowActions({
  id,
  number,
  status,
  currency,
  suggestedPkrAmount,
}: {
  id: string;
  number: number;
  status: InvoiceStatus;
  currency: PaymentCurrency;
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
      await markInvoiceUnpaid(id);
      setMarkUnpaidOpen(false);
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
              disabled={pending}
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
        onDelete={deleteInvoice.bind(null, id)}
      />
    </>
  );
}
