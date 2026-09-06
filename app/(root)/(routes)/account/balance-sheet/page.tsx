import { ArrowDownCircle, ArrowUpCircle, Scale } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPkr } from "@/lib/finance/constants";
import { getLedgerBalance, listLedgerEntries } from "@/actions/ledger/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  EARNING: "Earning",
  EXPENSE: "Expense",
  DONATION: "Donation",
  TEAM_PAYMENT: "Team Payment",
};

export default async function BalanceSheetPage() {
  await requirePagePermission("balance-sheet");
  const [balance, chronological] = await Promise.all([
    getLedgerBalance(),
    listLedgerEntries({ sort: "date-asc" }),
  ]);

  const rows = withRunningBalance(chronological).reverse();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Balance Sheet</h1>
        <p className="text-sm text-muted-foreground">
          Every credit and debit is recorded automatically as earnings,
          expenses, donations, and team pay are entered — nothing to add
          here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowUpCircle className="size-4" />
            <span className="text-xs font-medium">Total Credit</span>
          </div>
          <span className="text-lg font-medium tabular-nums">
            {formatPkr(balance.totalCredit)}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowDownCircle className="size-4" />
            <span className="text-xs font-medium">Total Debit</span>
          </div>
          <span className="text-lg font-medium tabular-nums">
            {formatPkr(balance.totalDebit)}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Scale className="size-4" />
            <span className="text-xs font-medium">Current Balance</span>
          </div>
          <span
            className={
              "text-lg font-medium tabular-nums " +
              (balance.balance < 0 ? "text-destructive" : "text-foreground")
            }
          >
            {formatPkr(balance.balance)}
          </span>
        </div>
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No ledger entries yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground">
                  {TYPE_LABELS[entry.type] ?? entry.type}
                </TableCell>
                <TableCell className="font-medium">{entry.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(entry.date)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(entry.debit) > 0 ? formatPkr(Number(entry.debit)) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(entry.credit) > 0
                    ? formatPkr(Number(entry.credit))
                    : "—"}
                </TableCell>
                <TableCell
                  className={
                    "text-right tabular-nums " +
                    (entry.runningBalance < 0 ? "text-destructive" : "")
                  }
                >
                  {formatPkr(entry.runningBalance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Accumulates a running balance across entries given oldest-first, without
 * mutating any variable in the page component's own scope (a plain helper
 * function, not a component, so it's exempt from the immutability lint
 * rule that guards against reassigning across renders). */
function withRunningBalance<T extends { credit: unknown; debit: unknown }>(
  entries: T[],
) {
  let running = 0;
  return entries.map((entry) => {
    running += Number(entry.credit) - Number(entry.debit);
    return { ...entry, runningBalance: running };
  });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
