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
import { formatPayslipNumber } from "@/lib/team/constants";
import { enqueueMutation } from "@/lib/sync/mutate";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export function PayslipRowActions({ id, number }: { id: string; number: number }) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Open actions menu" />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem render={<a href={`/api/payslips/${id}/pdf`} target="_blank" rel="noreferrer" />}>
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
        entryLabel={`payslip ${formatPayslipNumber(number)}`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deletePayslip",
            payload: { id },
            label: `payslip ${formatPayslipNumber(number)}`,
          });
          if (!result.ok) throw new Error(result.error);
        }}
      />
    </>
  );
}
