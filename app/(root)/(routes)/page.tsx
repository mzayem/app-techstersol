import { KpiCards } from "@/components/overview/kpi-cards";
import { RevenuePieChart } from "@/components/overview/revenue-pie-chart";
import { FinanceAreaChart } from "@/components/overview/finance-area-chart";
import { IncompleteContractsTable } from "@/components/overview/incomplete-contracts-table";
import {
  computeEarningKpis,
  getClientRevenueBreakdown,
  getIncompleteContracts,
  getMonthlySeries,
  getPendingPayments,
} from "@/actions/overview/queries";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [series, pending, clients, contracts] = await Promise.all([
    getMonthlySeries(),
    getPendingPayments(),
    getClientRevenueBreakdown(),
    getIncompleteContracts(),
  ]);

  const kpis = computeEarningKpis(series);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-lg font-medium">Overview</h1>

      <KpiCards
        currentMonthEarning={kpis.currentMonthEarning}
        avgMonthlyEarning={kpis.avgMonthlyEarning}
        totalEarning={kpis.totalEarning}
        totalExpenses={kpis.totalExpenses}
        totalDonations={kpis.totalDonations}
        totalInvestment={kpis.totalInvestment}
        unpaidInvoiceCount={pending.unpaidInvoiceCount}
        pendingByCurrency={pending.pendingByCurrency}
        pendingTotalPkr={pending.pendingTotalPkr}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FinanceAreaChart series={series} />
        </div>
        <RevenuePieChart clients={clients} />
      </div>

      <IncompleteContractsTable contracts={contracts} />
    </div>
  );
}
