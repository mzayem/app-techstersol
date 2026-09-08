import { renderBalanceSheetAudit } from "@/lib/reports/analysis/balance-sheet-audit";
import { renderCustomerPerformance } from "@/lib/reports/analysis/customer-performance";
import { renderMonthlyRevenue } from "@/lib/reports/analysis/monthly-revenue";
import { renderExpenseTracking } from "@/lib/reports/analysis/expense-tracking";
import { renderPerformance } from "@/lib/reports/analysis/performance";
import { renderTaxYearReport } from "@/lib/reports/analysis/tax-year";

export type AnalysisReportType =
  | "balance-sheet-audit"
  | "customer-performance"
  | "monthly-revenue"
  | "expense-tracking"
  | "performance"
  | "tax-year";

export type AnalysisReportDef = {
  title: string;
  description: string;
  filename: string;
  tab: "audit" | "performance" | "annual";
  /** "range" reports use the same date-range picker as the export dialogs;
   * "fiscalYear" reports (just the Annual Report) pick a July–June year
   * instead. */
  periodKind: "range" | "fiscalYear";
  render(params: Record<string, string | undefined>, generatedBy: string): Promise<Buffer>;
};

export const ANALYSIS_REPORTS: Record<AnalysisReportType, AnalysisReportDef> = {
  "balance-sheet-audit": {
    title: "Balance Sheet Audit",
    description: "Every credit and debit for the period, with a running balance.",
    filename: "balance-sheet-audit",
    tab: "audit",
    periodKind: "range",
    render: renderBalanceSheetAudit,
  },
  "customer-performance": {
    title: "Customer Performance",
    description: "Revenue by client, concentration, and the top performers.",
    filename: "customer-performance-report",
    tab: "audit",
    periodKind: "range",
    render: renderCustomerPerformance,
  },
  "monthly-revenue": {
    title: "Monthly Revenue Analysis",
    description: "Earning by month, averages, and trend over the period.",
    filename: "monthly-revenue-report",
    tab: "audit",
    periodKind: "range",
    render: renderMonthlyRevenue,
  },
  "expense-tracking": {
    title: "Expense Tracking",
    description: "Allocated vs. spent for every distribution bucket.",
    filename: "expense-tracking-report",
    tab: "performance",
    periodKind: "range",
    render: renderExpenseTracking,
  },
  performance: {
    title: "Performance Report",
    description: "Earning vs. expense trend and the distribution audit.",
    filename: "performance-report",
    tab: "performance",
    periodKind: "range",
    render: renderPerformance,
  },
  "tax-year": {
    title: "Annual Report",
    description: "Fiscal-year (Jul–Jun) summary with charts, ending in a signed sign-off.",
    filename: "annual-report",
    tab: "annual",
    periodKind: "fiscalYear",
    render: renderTaxYearReport,
  },
};

export function isAnalysisReportType(value: string): value is AnalysisReportType {
  return value in ANALYSIS_REPORTS;
}
