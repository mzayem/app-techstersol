import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalysisReportDialog } from "@/components/reports/analysis-report-dialog";
import { LetterheadEditor } from "@/components/reports/letterhead-editor";
import {
  ANALYSIS_REPORTS,
  type AnalysisReportType,
} from "@/lib/reports/analysis/registry";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { formatPkr } from "@/lib/finance/constants";
import { getPartnerEarningsReport } from "@/actions/partners/reports";

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

  const partnerEarnings = await getPartnerEarningsReport();

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
          <TabsTrigger value="partners">Earnings shared with partners</TabsTrigger>
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

        <TabsContent value="partners">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-card p-4 ring-1 ring-foreground/10">
                <p className="text-xs text-muted-foreground">Total paid out</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {formatPkr(partnerEarnings.totalPaid)}
                </p>
                <p className="text-xs text-muted-foreground">Issued as a payslip</p>
              </div>
              <div className="rounded-md bg-card p-4 ring-1 ring-foreground/10">
                <p className="text-xs text-muted-foreground">Total pending</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {formatPkr(partnerEarnings.totalPending)}
                </p>
                <p className="text-xs text-muted-foreground">Accrued, no payslip issued yet</p>
              </div>
            </div>

            <div className="rounded-md bg-card ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerEarnings.byPartner.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No partner earnings booked yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {partnerEarnings.byPartner.map((row) => (
                    <TableRow key={row.partnerId}>
                      <TableCell className="font-medium">{row.partnerName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPkr(row.paid)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPkr(row.pending)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatPkr(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="letterhead">
          <LetterheadEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
