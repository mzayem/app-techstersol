import { DownloadIcon } from "lucide-react";

import { StatTile } from "@/components/client-portal/stat-breakdown";
import { PartnerInvestmentsTabs } from "@/components/partners/partner-investments-tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPkr } from "@/lib/finance/constants";
import {
  formatPartnerInvestmentNumber,
  INVESTMENT_METHOD_LABELS,
} from "@/lib/partners/investment-constants";
import { requirePartnerUser } from "@/lib/rbac/permissions";
import {
  getPartnerOwnInvestmentBalance,
  listPartnerOwnInvestments,
  listPartnerOwnInvestmentSpends,
} from "@/actions/partner-portal/investment-queries";

export const dynamic = "force-dynamic";

export default async function PartnerInvestmentsPage() {
  const appUser = await requirePartnerUser();
  const partner = appUser.partner!;
  const [investments, spends, balance] = await Promise.all([
    listPartnerOwnInvestments(partner.id),
    listPartnerOwnInvestmentSpends(partner.id),
    getPartnerOwnInvestmentBalance(partner.id),
  ]);

  const investmentsTable = (
    <div className="rounded-md bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slip</TableHead>
            <TableHead>Funded by</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {investments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-8 text-center text-muted-foreground"
              >
                No investments recorded yet.
              </TableCell>
            </TableRow>
          )}
          {investments.map((investment) => (
            <TableRow key={investment.id}>
              <TableCell className="font-medium">
                {formatPartnerInvestmentNumber(investment.number)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {INVESTMENT_METHOD_LABELS[investment.method]}
                {investment.method === "ONLINE" && investment.transactionId
                  ? ` (${investment.transactionId})`
                  : ""}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {investment.partnerPayment?.contract?.projectName ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(investment.date)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPkr(Number(investment.amount))}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Download investment slip"
                  render={
                    <a
                      href={`/api/partner-investments/${investment.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <DownloadIcon />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const spendingTable = (
    <div className="rounded-md bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Spent on</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {spends.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-muted-foreground"
              >
                No spending logged yet.
              </TableCell>
            </TableRow>
          )}
          {spends.map((spend) => (
            <TableRow key={spend.id}>
              <TableCell className="font-medium">{spend.category}</TableCell>
              <TableCell className="text-muted-foreground">
                {spend.note ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(spend.date)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPkr(Number(spend.amount))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Investments</h1>
        <p className="text-sm text-muted-foreground">
          Money you&apos;ve invested with us and where it&apos;s been put to
          use.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Total invested" value={formatPkr(balance.invested)} />
        <StatTile label="Spent" value={formatPkr(balance.spent)} />
        <StatTile label="Available" value={formatPkr(balance.available)} />
      </div>

      <PartnerInvestmentsTabs
        investmentsTable={investmentsTable}
        spendingTable={spendingTable}
      />
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
