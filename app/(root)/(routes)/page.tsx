import { redirect } from "next/navigation";

import { KpiCards } from "@/components/overview/kpi-cards";
import { PeriodSelector } from "@/components/overview/period-selector";
import { RevenuePieChart } from "@/components/overview/revenue-pie-chart";
import { FinanceAreaChart } from "@/components/overview/finance-area-chart";
import { IncompleteContractsTable } from "@/components/overview/incomplete-contracts-table";
import { AttentionCard } from "@/components/overview/attention-card";
import { getAttentionGroups } from "@/actions/overview/attention";
import { checkPermission, getCurrentAppUser } from "@/lib/rbac/permissions";
import { resolveOverviewPeriod } from "@/lib/overview/period";
import {
  computeEarningKpis,
  getClientRevenueBreakdown,
  getDistributionAudit,
  getIncompleteContracts,
  getMonthlySeries,
  getPartnerPendingPayments,
  getPendingPayments,
  getTeamPendingPayments,
} from "@/actions/overview/queries";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/sign-in");
  const period = resolveOverviewPeriod(params.period, params.from, params.to);

  const [
    series,
    pending,
    teamPendingPkr,
    partnerPendingPkr,
    clients,
    contracts,
    attention,
  ] = await Promise.all([
    getMonthlySeries(),
    getPendingPayments(),
    getTeamPendingPayments(),
    getPartnerPendingPayments(),
    getClientRevenueBreakdown(period),
    getIncompleteContracts(period),
    getAttentionGroups({
      invoices: checkPermission(appUser, "invoices", "view"),
      contracts: checkPermission(appUser, "contracts", "view"),
      partnerPayslips: checkPermission(appUser, "partner-payslips", "view"),
    }),
  ]);

  const kpis = computeEarningKpis(series, period);
  const audit = getDistributionAudit(series, period);

  const periodKey = params.period ?? "this-year";
  const areaChartKey = `${periodKey}-${params.from ?? ""}-${params.to ?? ""}`;
  const areaChartRange =
    periodKey === "custom"
      ? ({
          initialRange: "custom" as const,
          initialFrom: period.from.toISOString().slice(0, 10),
          initialTo: period.to.toISOString().slice(0, 10),
        } as const)
      : periodKey === "last-year"
        ? ({
            initialRange: "custom" as const,
            initialFrom: period.from.toISOString().slice(0, 10),
            initialTo: period.to.toISOString().slice(0, 10),
          } as const)
        : ({ initialRange: "this-year" as const } as const);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Overview</h1>
        <PeriodSelector />
      </div>

      <AttentionCard groups={attention} />

      <KpiCards
        periodEarning={kpis.periodEarning}
        avgMonthlyEarning={kpis.avgMonthlyEarning}
        totalExpenses={kpis.totalExpenses}
        totalDonations={kpis.totalDonations}
        totalInvestment={kpis.totalInvestment}
        totalTeamPaid={kpis.totalTeamPaid}
        expensesAudit={audit.expenses}
        investmentAudit={audit.investment}
        donationAudit={audit.donation}
        unpaidInvoiceCount={pending.unpaidInvoiceCount}
        pendingByCurrency={pending.pendingByCurrency}
        pendingTotalPkr={pending.pendingTotalPkr}
        teamPendingPkr={teamPendingPkr}
        partnerPendingPkr={partnerPendingPkr}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FinanceAreaChart
            key={areaChartKey}
            series={series}
            {...areaChartRange}
          />
        </div>
        <RevenuePieChart clients={clients} />
      </div>

      <IncompleteContractsTable contracts={contracts} />
    </div>
  );
}
