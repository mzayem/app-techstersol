"use client";

import * as React from "react";
import {
  DownloadIcon,
  MailIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";

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
import { formatPartnerInvestmentNumber } from "@/lib/partners/investment-constants";
import { enqueueMutation } from "@/lib/sync/mutate";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";
import { toast } from "@/components/ui/toast";
import { actionErrorMessage } from "@/lib/action-error";
import { emailPartnerInvestmentSlip } from "@/actions/partners/investment-actions";

export function PartnerInvestmentRowActions({
  id,
  number,
}: {
  id: string;
  number: number;
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [, startSending] = React.useTransition();

  function sendEmail() {
    const toastId = toast.add({
      title: "Sending slip…",
      type: "loading",
      timeout: 0,
    });
    startSending(async () => {
      try {
        const result = await emailPartnerInvestmentSlip(id);
        toast.update(toastId, {
          title: result.ok
            ? `Slip ${formatPartnerInvestmentNumber(number)} sent to ${result.sentTo}`
            : result.error,
          type: result.ok ? "success" : "error",
          timeout: 4000,
        });
      } catch (e) {
        toast.update(toastId, {
          title: actionErrorMessage(e, "Couldn't send the email"),
          type: "error",
          timeout: 5000,
        });
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open actions menu"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              render={
                <a
                  href={`/api/partner-investments/${id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <DownloadIcon />
              Download slip
            </DropdownMenuItem>
            <DropdownMenuItem onClick={sendEmail}>
              <MailIcon />
              Send email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`investment ${formatPartnerInvestmentNumber(number)}`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deletePartnerInvestment",
            payload: { id },
            label: `partner investment ${formatPartnerInvestmentNumber(number)}`,
          });
          if (!result.ok) throw new Error(result.error);
        }}
      />
    </>
  );
}
