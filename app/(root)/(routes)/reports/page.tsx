import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AnalysisReportDialog } from "@/components/reports/analysis-report-dialog";
import { LetterheadEditor } from "@/components/reports/letterhead-editor";
import {
  ANALYSIS_REPORTS,
  type AnalysisReportType,
} from "@/lib/reports/analysis/registry";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

const ANALYSIS_TABS = [
  { value: "audit", label: "Audit Reports" },
  { value: "performance", label: "Performance Reports" },
  { value: "annual", label: "Annual Report" },
] as const;

export default async function ReportsPage() {
  await requirePagePermission("reports");

  const entries = Object.entries(ANALYSIS_REPORTS) as [
    AnalysisReportType,
    (typeof ANALYSIS_REPORTS)[AnalysisReportType],
  ][];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Curated analysis documents — pick a period and download a PDF.
        </p>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          {ANALYSIS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="letterhead">Letterhead</TabsTrigger>
        </TabsList>

        {ANALYSIS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entries
                .filter(([, def]) => def.tab === tab.value)
                .map(([type, def]) => (
                  <AnalysisReportDialog
                    key={type}
                    type={type}
                    title={def.title}
                    description={def.description}
                    periodKind={def.periodKind}
                  />
                ))}
            </div>
          </TabsContent>
        ))}

        <TabsContent value="letterhead">
          <LetterheadEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
