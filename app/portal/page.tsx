import { PortalProjectsChart } from "@/components/portal/portal-projects-chart";
import { formatPkr } from "@/lib/finance/constants";
import { requireTeamUser } from "@/lib/rbac/permissions";
import { getPortalOverview } from "@/actions/portal/queries";

export const dynamic = "force-dynamic";

export default async function PortalOverviewPage() {
  const appUser = await requireTeamUser();
  const teamMember = appUser.teamMember!;
  const overview = await getPortalOverview(teamMember.id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Welcome, {teamMember.name}</h1>
        <p className="text-sm text-muted-foreground">
          Your projects, pay, and work diary at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <span className="text-xs font-medium text-muted-foreground">
            Paid to you this year
          </span>
          <span className="text-lg font-medium tabular-nums">
            {formatPkr(overview.paidThisYearPkr)}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <span className="text-xs font-medium text-muted-foreground">
            Pending payment
          </span>
          <span className="text-lg font-medium tabular-nums">
            {formatPkr(overview.pendingPaymentPkr)}
          </span>
        </div>
      </div>

      <PortalProjectsChart
        completed={overview.completedProjects}
        pending={overview.pendingProjects}
      />
    </div>
  );
}
