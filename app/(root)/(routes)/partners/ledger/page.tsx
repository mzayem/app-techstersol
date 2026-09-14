import { HandCoins, Landmark, PiggyBank, Receipt } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { getPartnerLedger, summarizePartnerLedger } from "@/actions/partners/ledger-queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function PartnerLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePagePermission("partner-ledger");
  const params = await searchParams;

  const rows = await getPartnerLedger();
  const totals = summarizePartnerLedger(rows);
  const paginated = paginate(rows, parsePageParam(params.page), parsePageSizeParam(params.pageSize));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Partner Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Every partner payment, with the project revenue, work cost, and expenses behind it —
          booked automatically the moment a partnered project completes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon={Landmark} label="Total revenue" value={formatPkr(totals.totalRevenue)} />
        <Tile icon={Receipt} label="Work cost + expenses" value={formatPkr(totals.totalWorkCost + totals.totalExpenses)} />
        <Tile icon={HandCoins} label="Total partner share" value={formatPkr(totals.totalShare)} />
        <Tile
          icon={PiggyBank}
          label="Paid / Pending"
          value={`${formatPkr(totals.totalPaid)} / ${formatPkr(totals.totalPending)}`}
        />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Work cost</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Their share</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No partner payments booked yet.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">{formatDate(row.date)}</TableCell>
                <TableCell className="font-medium">{row.partnerName}</TableCell>
                <TableCell className="text-muted-foreground">{row.projectName ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.revenueAmount != null ? formatPkr(row.revenueAmount) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.workCostAmount != null ? formatPkr(row.workCostAmount) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.projectExpensesAmount != null ? formatPkr(row.projectExpensesAmount) : "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatPkr(row.amount)}
                  {row.sharePercentageUsed != null && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.sharePercentageUsed}% of profit
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {row.issued ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Paid {row.payslipNumber ? `(PP-${String(row.payslipNumber).padStart(5, "0")})` : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                      Pending
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          totalItems={paginated.totalItems}
          pageSize={paginated.pageSize}
        />
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-lg font-medium tabular-nums">{value}</span>
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

function formatPkr(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}
