import { EarningDialog, EarningRowActions } from "@/components/finance/earning-dialog";
import { FilterBar } from "@/components/finance/filter-bar";
import { StatCards } from "@/components/finance/stat-cards";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveDateRange } from "@/lib/finance/date-range";
import { CURRENCY_SYMBOLS, formatPkr, type ReferenceCurrency } from "@/lib/finance/constants";
import { getBucketBalances, listEarnings, type SortOption } from "@/lib/finance/queries";

export const dynamic = "force-dynamic";

export default async function EarningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const dateRange = resolveDateRange(params.range, params.from, params.to);

  const [earnings, balances] = await Promise.all([
    listEarnings({
      dateRange,
      search: params.q,
      sort: params.sort as SortOption | undefined,
    }),
    getBucketBalances(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Earning</h1>
        <EarningDialog />
      </div>

      <StatCards balances={balances} />

      <FilterBar />

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Team pay</TableHead>
              <TableHead className="text-right">Net earning</TableHead>
              <TableHead className="text-right">Reference</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {earnings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No earnings recorded for this range.
                </TableCell>
              </TableRow>
            )}
            {earnings.map((earning) => {
              const amount = Number(earning.amount);
              const teamPay = Number(earning.teamPay);
              const entry = {
                id: earning.id,
                date: earning.date,
                name: earning.name,
                amount,
                teamPay,
                referenceAmount: earning.referenceAmount ? Number(earning.referenceAmount) : null,
                referenceCurrency: earning.referenceCurrency as ReferenceCurrency | null,
              };
              return (
                <TableRow key={earning.id}>
                  <TableCell>{formatDate(earning.date)}</TableCell>
                  <TableCell className="font-medium">{earning.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPkr(amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPkr(teamPay)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatPkr(amount - teamPay)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {earning.referenceAmount && earning.referenceCurrency
                      ? `${CURRENCY_SYMBOLS[earning.referenceCurrency as ReferenceCurrency]}${Number(earning.referenceAmount).toLocaleString()}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <EarningRowActions entry={entry} />
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
