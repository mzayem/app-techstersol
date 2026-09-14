"use client";

import * as React from "react";
import { DownloadIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPartnerPayslipNumber } from "@/lib/partners/constants";
import { enqueueMutation } from "@/lib/sync/mutate";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";
import { SendEmailDialog } from "@/components/mail/send-email-dialog";

export function PartnerPayslipRowActions({
  id,
  number,
  partnerEmail,
}: {
  id: string;
  number: number;
  partnerEmail: string | null;
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <SendEmailDialog
        defaultTo={partnerEmail ?? ""}
        record={{ kind: "partner-payslip", id }}
        disabled={!partnerEmail}
        disabledReason="This partner has no email on file"
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Open actions menu" />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              render={<a href={`/api/partner-payslips/${id}/pdf`} target="_blank" rel="noreferrer" />}
            >
              <DownloadIcon />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`payslip ${formatPartnerPayslipNumber(number)}`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deletePartnerPayslip",
            payload: { id },
            label: `partner payslip ${formatPartnerPayslipNumber(number)}`,
          });
          if (!result.ok) throw new Error(result.error);
        }}
      />
    </>
  );
}
