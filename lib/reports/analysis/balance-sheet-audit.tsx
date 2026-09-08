import { getLedgerBalance, listLedgerEntries } from "@/actions/ledger/queries";
import { formatPkr } from "@/lib/finance/constants";
import {
  AnalysisTable,
  Paragraph,
  Section,
  renderAnalysisPdf,
} from "@/lib/reports/analysis/layout";
import { resolveAnalysisRange, periodLabel } from "@/lib/reports/analysis/period";

const TYPE_LABELS: Record<string, string> = {
  EARNING: "Earning",
  EXPENSE: "Expense",
  DONATION: "Donation",
  TEAM_PAYMENT: "Team Payment",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function renderBalanceSheetAudit(
  params: Record<string, string | undefined>,
  generatedBy: string,
): Promise<Buffer> {
  const range = resolveAnalysisRange(params);
  const label = periodLabel(params, range);

  const [balance, entries] = await Promise.all([
    getLedgerBalance(),
    listLedgerEntries({ dateRange: range, sort: "date-asc" }),
  ]);

  const periodDebit = entries.reduce((sum, e) => sum + Number(e.debit), 0);
  const periodCredit = entries.reduce((sum, e) => sum + Number(e.credit), 0);
  const periodNet = periodCredit - periodDebit;

  let running = 0;
  const rows = entries.map((entry) => {
    running += Number(entry.credit) - Number(entry.debit);
    return {
      date: formatDate(entry.date),
      type: TYPE_LABELS[entry.type] ?? entry.type,
      name: entry.name,
      debit: Number(entry.debit) > 0 ? formatPkr(Number(entry.debit)) : "",
      credit: Number(entry.credit) > 0 ? formatPkr(Number(entry.credit)) : "",
      balance: formatPkr(running),
    };
  });

  const body = (
    <>
      <Section heading="Summary">
        <Paragraph>
          This audit covers every credit and debit posted to the ledger
          {label === "All time" ? " across its full recorded history" : ` during ${label}`}.
          Over this period the company recorded {formatPkr(periodCredit)} in credits against{" "}
          {formatPkr(periodDebit)} in debits, a net movement of {formatPkr(periodNet)}. The
          ledger’s all-time balance — every credit and debit ever recorded, independent of the
          period selected for this report — currently stands at {formatPkr(balance.balance)} (
          {formatPkr(balance.totalCredit)} total credit against {formatPkr(balance.totalDebit)}{" "}
          total debit).
        </Paragraph>
        <Paragraph>
          {periodNet >= 0
            ? "The company brought in more than it paid out over this period, growing its recorded cash position."
            : "The company paid out more than it brought in over this period, drawing down its recorded cash position."}
        </Paragraph>
      </Section>
      <Section heading="Ledger entries for the period">
        <AnalysisTable
          columns={[
            { key: "date", label: "Date" },
            { key: "type", label: "Type" },
            { key: "name", label: "Description" },
            { key: "debit", label: "Debit", align: "right" },
            { key: "credit", label: "Credit", align: "right" },
            { key: "balance", label: "Running balance", align: "right" },
          ]}
          rows={rows}
          totalsRow={{
            date: "",
            type: "",
            name: "Period total",
            debit: formatPkr(periodDebit),
            credit: formatPkr(periodCredit),
            balance: formatPkr(running),
          }}
        />
      </Section>
    </>
  );

  return renderAnalysisPdf("BALANCE SHEET AUDIT REPORT", label, generatedBy, body);
}
