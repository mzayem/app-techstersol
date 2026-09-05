"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  formatContractAmount,
  type ContractStatus,
} from "@/lib/contracts/constants";
import { bulkUpdateContractStatus } from "@/actions/contracts/actions";
import {
  ContractRowActions,
  type ClientOption,
  type ContractEntry,
} from "@/components/contracts/contract-dialog";

export type ContractListItem = ContractEntry & {
  clientName: string;
  totalAmount: number;
};

export function ContractTable({
  contracts,
  clients,
}: {
  contracts: ContractListItem[];
  clients: ClientOption[];
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = React.useState<number | null>(null);
  const modifierRef = React.useRef({ shift: false });
  const [pending, startTransition] = React.useTransition();
  const [bulkStatus, setBulkStatus] = React.useState<ContractStatus>("ACTIVE");

  // Ids can go stale after a delete/filter change, so derive the visible
  // selection from the current contracts rather than pruning state directly.
  const visibleSelectedIds = React.useMemo(
    () => contracts.filter((c) => selected.has(c.id)).map((c) => c.id),
    [contracts, selected],
  );

  function captureShift(e: React.MouseEvent) {
    modifierRef.current.shift = e.shiftKey;
  }

  function toggleRow(index: number, id: string) {
    const { shift } = modifierRef.current;
    if (shift && anchorIndex !== null) {
      const [lo, hi] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
      const rangeIds = contracts.slice(lo, hi + 1).map((c) => c.id);
      setSelected((prev) => new Set([...prev, ...rangeIds]));
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchorIndex(index);
    }
  }

  function onRowClick(index: number, id: string, e: React.MouseEvent) {
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
    modifierRef.current.shift = e.shiftKey;
    toggleRow(index, id);
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === contracts.length ? new Set() : new Set(contracts.map((c) => c.id)),
    );
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function applyBulkStatus() {
    startTransition(async () => {
      await bulkUpdateContractStatus(visibleSelectedIds, bulkStatus);
      clearSelection();
    });
  }

  const allSelected = contracts.length > 0 && visibleSelectedIds.length === contracts.length;
  const someSelected = visibleSelectedIds.length > 0 && !allSelected;

  return (
    <div className="flex flex-col gap-3">
      {visibleSelectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3">
          <span className="text-sm font-medium">{visibleSelectedIds.length} selected</span>
          <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as ContractStatus)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CONTRACT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={pending} onClick={applyBulkStatus}>
            {pending ? "Updating…" : "Change status"}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onClick={captureShift}
                  onCheckedChange={toggleAll}
                  aria-label="Select all contracts"
                />
              </TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Start date</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No contracts found.
                </TableCell>
              </TableRow>
            )}
            {contracts.map((contract, index) => {
              const isSelected = selected.has(contract.id);
              return (
                <TableRow
                  key={contract.id}
                  data-state={isSelected ? "selected" : undefined}
                  onClick={(e) => onRowClick(index, contract.id, e)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onClick={captureShift}
                      onCheckedChange={() => toggleRow(index, contract.id)}
                      aria-label={`Select ${contract.projectName}`}
                    />
                  </TableCell>
                  <TableCell>{contract.clientName}</TableCell>
                  <TableCell className="font-medium">{contract.projectName}</TableCell>
                  <TableCell>{formatDate(contract.date)}</TableCell>
                  <TableCell>{formatDate(contract.deadline)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {PAYMENT_TYPE_LABELS[contract.paymentType]}
                    {contract.paymentType === "MILESTONE" && (
                      <span className="block text-xs">
                        {contract.milestones.length} installment
                        {contract.milestones.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatContractAmount(contract.totalAmount, contract.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={contract.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <ContractRowActions entry={contract} clients={clients} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ContractStatus }) {
  const styles: Record<ContractStatus, string> = {
    PROPOSED: "bg-muted text-muted-foreground",
    ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    PENDING_PAYMENT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    COMPLETED: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + styles[status]
      }
    >
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
