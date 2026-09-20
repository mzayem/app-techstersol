"use client";

import * as React from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { enqueueMutation } from "@/lib/sync/mutate";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export function PartnerInvestmentSpendRowActions({
  id,
  category,
}: {
  id: string;
  category: string;
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete spending entry"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2Icon />
      </Button>
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`spending entry "${category}"`}
        onDelete={async () => {
          const result = await enqueueMutation({
            key: "deletePartnerInvestmentSpend",
            payload: { id },
            label: `investment spending entry`,
          });
          if (!result.ok) throw new Error(result.error);
        }}
      />
    </>
  );
}
