import Link from "next/link";

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  CONTRACT_STATUS_LABELS,
  formatContractAmount,
  type ContractStatus,
} from "@/lib/contracts/constants";
import type { IncompleteContract } from "@/actions/overview/queries";

const STATUS_STYLES: Record<ContractStatus, string> = {
  PROPOSED: "bg-muted text-muted-foreground",
  UPFRONT_PAYMENT: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PENDING_PAYMENT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PARTIALLY_PAID: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  COMPLETED: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  PAUSED: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function IncompleteContractsTable({
  contracts,
}: {
  contracts: IncompleteContract[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contracts still in progress</CardTitle>
        <CardDescription>Started within the selected period</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/projects/contracts" />}
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <div className="rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Every contract is completed.
                </TableCell>
              </TableRow>
            )}
            {contracts.map((contract) => {
              const status = contract.status as ContractStatus;
              return (
                <TableRow key={contract.id}>
                  <TableCell>{contract.clientName}</TableCell>
                  <TableCell className="font-medium">{contract.projectName}</TableCell>
                  <TableCell>{formatDate(contract.deadline)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatContractAmount(contract.amount, contract.currency)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                        STATUS_STYLES[status]
                      }
                    >
                      {CONTRACT_STATUS_LABELS[status]}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
