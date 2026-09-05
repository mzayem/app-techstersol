"use client";

import {
  CheckCircleIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
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
import type { InvoiceStatus } from "@/lib/invoices/constants";

export function InvoiceActionsMenu({
  status,
  pdfHref,
  onMarkPaid,
  onMarkUnpaid,
  onDelete,
}: {
  status: InvoiceStatus;
  pdfHref: string;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Open actions menu" />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem render={<a href={pdfHref} target="_blank" rel="noreferrer" />}>
            <DownloadIcon />
            Download PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status === "UNPAID" ? (
            <DropdownMenuItem onClick={onMarkPaid}>
              <CheckCircleIcon />
              Mark as paid
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onMarkUnpaid}>
              <RotateCcwIcon />
              Mark as unpaid
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
