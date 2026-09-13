import { MailIcon, PhoneIcon } from "lucide-react";

import { PortalProjectsChart } from "@/components/portal/portal-projects-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatContractAmount } from "@/lib/contracts/constants";
import { formatInvoiceNumber, COMPANY_INFO } from "@/lib/invoices/constants";
import { requireClientUser } from "@/lib/rbac/permissions";
import { getClientOverview } from "@/actions/client-portal/queries";

export const dynamic = "force-dynamic";

export default async function ClientPortalOverviewPage() {
  const appUser = await requireClientUser();
  const client = appUser.client!;
  const overview = await getClientOverview(client.id);

  const pendingEntries = Object.entries(overview.pendingPaymentByCurrency) as [
    string,
    number,
  ][];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Welcome, {client.name}</h1>
        <p className="text-sm text-muted-foreground">
          Your projects and invoices at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Pending payment"
          value={
            pendingEntries.length === 0
              ? formatContractAmount(0, client.currency)
              : pendingEntries
                  .map(([currency, amount]) => formatContractAmount(amount, currency))
                  .join(" · ")
          }
        />
        <StatTile label="Total projects" value={String(overview.totalProjects)} />
        <StatTile label="Completed" value={String(overview.completedProjects)} />
        <StatTile label="Pending" value={String(overview.pendingProjects)} />
      </div>

      {overview.nextDueInvoice && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
            <div>
              <p className="text-sm font-medium">
                Invoice {formatInvoiceNumber(overview.nextDueInvoice.number)} is due{" "}
                {formatDate(overview.nextDueInvoice.dueDate)}
              </p>
              <p className="text-sm text-muted-foreground">
                Outstanding balance:{" "}
                {formatContractAmount(
                  overview.nextDueInvoice.amount,
                  overview.nextDueInvoice.currency,
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PortalProjectsChart
          completed={overview.completedProjects}
          pending={overview.pendingProjects}
        />

        <Card>
          <CardHeader>
            <CardTitle>Need help?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Reach out any time — we&apos;re happy to help with your projects and invoices.
            </p>
            <a
              href={`mailto:${COMPANY_INFO.email}`}
              className="flex items-center gap-2 text-foreground hover:underline"
            >
              <MailIcon className="size-4 text-muted-foreground" />
              {COMPANY_INFO.email}
            </a>
            <a
              href={`tel:${COMPANY_INFO.phone.replace(/[^\d+]/g, "")}`}
              className="flex items-center gap-2 text-foreground hover:underline"
            >
              <PhoneIcon className="size-4 text-muted-foreground" />
              {COMPANY_INFO.phone}
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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
