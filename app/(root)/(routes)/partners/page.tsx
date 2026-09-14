import {
  PartnerDialog,
  PartnerRowActions,
} from "@/components/partners/partner-dialog";
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
import { listPartners } from "@/actions/partners/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { permission } = await requirePagePermission("partners");
  const params = await searchParams;
  const partners = await listPartners({});
  const paginated = paginate(
    partners,
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Partners</h1>
        {permission.canCreate && <PartnerDialog />}
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Share</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Chat</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No partners yet.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((partner) => {
              const entry = {
                id: partner.id,
                name: partner.name,
                phone: partner.phone,
                email: partner.email,
                currency: partner.currency as PaymentCurrency,
                sharePercentage: Number(partner.sharePercentage),
                payslipEmailsEnabled: partner.payslipEmailsEnabled,
                chatEnabled: partner.chatEnabled,
              };
              return (
                <PartnerRowActions
                  key={partner.id}
                  entry={entry}
                  canEdit={permission.canEdit}
                  canDelete={permission.canDelete}
                >
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.sharePercentage}%
                  </TableCell>
                  <TableCell>{partner.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {partner.email ?? "—"}
                  </TableCell>
                  <TableCell>{partner.currency}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {partner.chatEnabled ? "Can post" : "Read-only"}
                  </TableCell>
                </PartnerRowActions>
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
