import { AnalysisReportDialog } from "@/components/reports/analysis-report-dialog";
import { ANALYSIS_REPORTS, type AnalysisReportType } from "@/lib/reports/analysis/registry";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function AuditReportsPage() {
  await requirePagePermission("reports-audit");

  const entries = (
    Object.entries(ANALYSIS_REPORTS) as [AnalysisReportType, (typeof ANALYSIS_REPORTS)[AnalysisReportType]][]
  ).filter(([, def]) => def.tab === "audit");

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Audit Reports</h1>
        <p className="text-sm text-muted-foreground">
          Curated analysis documents — pick a period and download a PDF.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([type, def]) => (
          <AnalysisReportDialog
            key={type}
            type={type}
            title={def.title}
            description={def.description}
            periodKind={def.periodKind}
          />
        ))}
      </div>
    </div>
  );
}
