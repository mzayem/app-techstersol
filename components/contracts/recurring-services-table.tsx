import { FileBadgeIcon } from "lucide-react";
import { formatContractNumber } from "@/lib/contracts/numbering-format";

import { Button } from "@/components/ui/button";
import { ContractChatButton } from "@/components/contracts/contract-chat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RECURRING_BILLING_STATUSES,
  contractStatusLabel,
} from "@/lib/contracts/constants";
import { formatBillingDate } from "@/lib/contracts/billing";

export type RecurringServiceRow = {
  id: string;
  number: number;
  projectName: string;
  description: string | null;
  /** Shown only when `showClient` is set. */
  clientName?: string;
  date: Date;
  deadline: Date | null;
  /** e.g. "$500 / month" — omitted for team logins (fees are private). */
  billing?: string;
  nextInvoiceDate: Date | null;
  status: string;
};

/** The portals' list of recurring services — client, partner and team
 * logins each see their own, with only the columns their portal allows. */
export function RecurringServicesTable({
  rows,
  showClient = false,
  showBilling = true,
  showAgreement = true,
  chatReadOnly = false,
  emptyText = "No recurring services yet.",
}: {
  rows: RecurringServiceRow[];
  showClient?: boolean;
  showBilling?: boolean;
  showAgreement?: boolean;
  chatReadOnly?: boolean;
  emptyText?: string;
}) {
  const columns = 5 + (showClient ? 1 : 0) + (showBilling ? 2 : 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          {showClient && <TableHead>Client</TableHead>}
          <TableHead>Start date</TableHead>
          <TableHead>End date</TableHead>
          {showBilling && (
            <>
              <TableHead className="text-right">Billing</TableHead>
              <TableHead>Next invoice</TableHead>
            </>
          )}
          <TableHead>Status</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={columns}
              className="py-8 text-center text-muted-foreground"
            >
              {emptyText}
            </TableCell>
          </TableRow>
        )}
        {rows.map((row) => {
          const billing = (
            RECURRING_BILLING_STATUSES as readonly string[]
          ).includes(row.status);
          const finished =
            !row.nextInvoiceDate ||
            (row.deadline && row.nextInvoiceDate > row.deadline);
          return (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                <span className="mr-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                  {formatContractNumber(row.number)}
                </span>
                {row.projectName}
                {row.description && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {row.description}
                  </span>
                )}
              </TableCell>
              {showClient && (
                <TableCell className="text-muted-foreground">
                  {row.clientName}
                </TableCell>
              )}
              <TableCell className="text-muted-foreground">
                {formatBillingDate(row.date)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.deadline ? formatBillingDate(row.deadline) : "Ongoing"}
              </TableCell>
              {showBilling && (
                <>
                  <TableCell className="text-right tabular-nums">
                    {row.billing}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {billing && !finished
                      ? formatBillingDate(row.nextInvoiceDate!)
                      : "—"}
                  </TableCell>
                </>
              )}
              <TableCell>
                {contractStatusLabel(row.status, "RECURRING")}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {showAgreement && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Download service agreement"
                      title="Service agreement"
                      nativeButton={false}
                      render={
                        <a
                          href={`/api/contracts/${row.id}/agreement`}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <FileBadgeIcon />
                    </Button>
                  )}
                  <ContractChatButton
                    contractId={row.id}
                    projectName={row.projectName}
                    readOnly={chatReadOnly}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
