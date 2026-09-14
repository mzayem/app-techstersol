import { MailIcon, PhoneIcon } from "lucide-react";

import { PortalProjectsChart } from "@/components/portal/portal-projects-chart";
import { StatTile } from "@/components/client-portal/stat-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import { formatInvoiceNumber, COMPANY_INFO } from "@/lib/invoices/constants";
import {
  getActiveClientProfiles,
  requireClientUser,
} from "@/lib/rbac/permissions";
import { getClientOverview } from "@/actions/client-portal/queries";

export const dynamic = "force-dynamic";

function formatCurrencyMap(
  map: Partial<Record<PaymentCurrency, number>>,
  fallback: PaymentCurrency,
) {
  const entries = Object.entries(map) as [PaymentCurrency, number][];
  if (entries.length === 0) return formatContractAmount(0, fallback);
  return entries
    .map(([currency, amount]) => formatContractAmount(amount, currency))
    .join(" · ");
}

export default async function ClientPortalOverviewPage() {
  const appUser = await requireClientUser();
  const profiles = getActiveClientProfiles(appUser);
  const overview = await getClientOverview(profiles);
  const isMultiProfile = profiles.length > 1;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        {isMultiProfile ? (
          <>
            <h1 className="text-lg font-medium">Welcome</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profiles.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <h1 className="text-lg font-medium">Welcome, {profiles[0]?.name}</h1>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          Your projects and invoices at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Pending payment"
          value={formatCurrencyMap(
            overview.pendingPaymentByCurrency,
            profiles[0]?.currency,
          )}
          breakdown={overview.pendingPaymentByProfile.map((p) => ({
            label: p.clientName,
            value: formatCurrencyMap(p.value, profiles[0]?.currency),
          }))}
        />
        <StatTile
          label="Total projects"
          value={String(overview.totalProjects)}
          breakdown={overview.totalProjectsByProfile.map((p) => ({
            label: p.clientName,
            value: String(p.value),
          }))}
        />
        <StatTile
          label="Completed"
          value={String(overview.completedProjects)}
          breakdown={overview.completedProjectsByProfile.map((p) => ({
            label: p.clientName,
            value: String(p.value),
          }))}
        />
        <StatTile
          label="Pending"
          value={String(overview.pendingProjects)}
          breakdown={overview.pendingProjectsByProfile.map((p) => ({
            label: p.clientName,
            value: String(p.value),
          }))}
        />
      </div>

      {overview.nextDueInvoice && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
            <div>
              <p className="text-sm font-medium">
                Invoice {formatInvoiceNumber(overview.nextDueInvoice.number)} is
                due {formatDate(overview.nextDueInvoice.dueDate)}
                {isMultiProfile && ` (${overview.nextDueInvoice.clientName})`}
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
              Reach out any time — we&apos;re happy to help with your projects
              and invoices.
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
