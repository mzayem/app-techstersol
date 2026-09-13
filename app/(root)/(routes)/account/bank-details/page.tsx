import {
  BankAccountDialog,
  BankAccountRowActions,
} from "@/components/bank-accounts/bank-account-dialog";
import { BankAccountFilterBar } from "@/components/bank-accounts/bank-account-filter-bar";
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
import type { PaymentCurrency } from "@/lib/clients/constants";
import {
  BANK_FIELD_LABELS,
  CURRENCY_FIELDS,
} from "@/lib/bank-accounts/constants";
import {
  listBankAccounts,
  type SortOption,
} from "@/actions/bank-accounts/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function BankDetailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { permission } = await requirePagePermission("bank-details");
  const params = await searchParams;

  const bankAccounts = await listBankAccounts({
    search: params.q,
    currency: params.currency as PaymentCurrency | undefined,
    sort: params.sort as SortOption | undefined,
  });
  const paginated = paginate(bankAccounts, parsePageParam(params.page), parsePageSizeParam(params.pageSize));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Bank details</h1>
        {permission.canCreate && <BankAccountDialog />}
      </div>

      <BankAccountFilterBar />

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Currency</TableHead>
              <TableHead>Bank name</TableHead>
              <TableHead>Account holder</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>SWIFT</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No bank accounts found.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((account) => {
              const currency = account.currency as PaymentCurrency;
              const entry = {
                id: account.id,
                currency,
                bankName: account.bankName,
                accountHolderName: account.accountHolderName,
                swift: account.swift,
                accountType: account.accountType,
                routingNumber: account.routingNumber,
                accountNumber: account.accountNumber,
                iban: account.iban,
                sortCode: account.sortCode,
                bsbCode: account.bsbCode,
              };
              return (
                <BankAccountRowActions
                  key={account.id}
                  entry={entry}
                  canEdit={permission.canEdit}
                  canDelete={permission.canDelete}
                >
                  <TableCell className="font-medium">{currency}</TableCell>
                  <TableCell>{account.bankName}</TableCell>
                  <TableCell>{account.accountHolderName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {CURRENCY_FIELDS[currency].map((field) => (
                      <div key={field} className="text-xs whitespace-nowrap">
                        {BANK_FIELD_LABELS[field]}: {entry[field] ?? "—"}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell>{account.swift}</TableCell>
                </BankAccountRowActions>
              );
            })}
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
