import {
  ExpenseDialog,
  ExpenseRowActions,
} from "@/components/finance/expense-dialog";
import { ExpenseImportDialog } from "@/components/finance/expense-import-dialog";
import { FilterBar } from "@/components/finance/filter-bar";
import { StatCards } from "@/components/finance/stat-cards";
import { ExportReportButton } from "@/components/reports/export-report-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveDateRange } from "@/lib/finance/date-range";
import {
  BUCKET_LABELS,
  EXPENSE_CATEGORIES,
  formatPkr,
  type ExpenseCategory,
} from "@/lib/finance/constants";
import {
  getBucketBalances,
  listExpenses,
  type SortOption,
} from "@/actions/finance/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { permission } = await requirePagePermission("expenses");
  const params = await searchParams;
  const dateRange = resolveDateRange(params.range, params.from, params.to);
  const category = EXPENSE_CATEGORIES.includes(params.category as ExpenseCategory)
    ? (params.category as ExpenseCategory)
    : undefined;

  const [expenses, balances] = await Promise.all([
    listExpenses({
      dateRange,
      search: params.q,
      sort: params.sort as SortOption | undefined,
      category,
    }),
    getBucketBalances(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Expenses</h1>
        <div className="flex items-center gap-2">
          <ExportReportButton module="expenses" />
          {permission.canCreate && (
            <>
              <ExpenseImportDialog />
              <ExpenseDialog />
            </>
          )}
        </div>
      </div>

      <StatCards balances={balances} />

      <FilterBar categoryFilter />

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No expenses recorded for this range.
                </TableCell>
              </TableRow>
            )}
            {expenses.map((expense) => (
              <ExpenseRowActions
                key={expense.id}
                entry={{
                  id: expense.id,
                  date: expense.date,
                  category: expense.category as ExpenseCategory,
                  name: expense.name,
                  amount: Number(expense.amount),
                }}
              >
                <TableCell>{formatDate(expense.date)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {BUCKET_LABELS[expense.category as ExpenseCategory]}
                </TableCell>
                <TableCell className="font-medium">{expense.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPkr(Number(expense.amount))}
                </TableCell>
              </ExpenseRowActions>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
