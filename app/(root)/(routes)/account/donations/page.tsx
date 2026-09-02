import { DonationDialog } from "@/components/finance/donation-dialog";
import { FilterBar } from "@/components/finance/filter-bar";
import { StatCards } from "@/components/finance/stat-cards";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveDateRange } from "@/lib/finance/date-range";
import { formatPkr } from "@/lib/finance/constants";
import { getBucketBalances, listDonations, type SortOption } from "@/lib/finance/queries";

export const dynamic = "force-dynamic";

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const dateRange = resolveDateRange(params.range, params.from, params.to);

  const [donations, balances] = await Promise.all([
    listDonations({
      dateRange,
      search: params.q,
      sort: params.sort as SortOption | undefined,
    }),
    getBucketBalances(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Donations</h1>
        <DonationDialog />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {donations.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  No donations recorded for this range.
                </TableCell>
              </TableRow>
            )}
            {donations.map((donation) => (
              <TableRow key={donation.id}>
                <TableCell>{formatDate(donation.date)}</TableCell>
                <TableCell className="font-medium">{donation.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPkr(Number(donation.amount))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
