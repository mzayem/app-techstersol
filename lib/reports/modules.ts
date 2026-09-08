import type { PageKey } from "@/lib/rbac/pages";
import type { ReportSpec } from "@/lib/reports/types";
import { resolveDateRange, DATE_PRESET_LABELS, type DatePreset } from "@/lib/finance/date-range";
import {
  BUCKET_LABELS,
  CURRENCY_SYMBOLS,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ReferenceCurrency,
} from "@/lib/finance/constants";
import type { PaymentCurrency } from "@/lib/clients/constants";
import {
  CONTRACT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  formatContractAmount,
  type ContractStatus,
  type ContractPaymentType,
} from "@/lib/contracts/constants";
import {
  INVOICE_STATUS_LABELS,
  formatInvoiceNumber,
  type InvoiceStatus,
} from "@/lib/invoices/constants";
import { formatPayslipNumber } from "@/lib/team/constants";
import {
  listEarnings,
  listDonations,
  listExpenses,
  type SortOption as FinanceSortOption,
} from "@/actions/finance/queries";
import {
  listContracts,
  type SortOption as ContractSortOption,
} from "@/actions/contracts/queries";
import {
  listInvoices,
  type SortOption as InvoiceSortOption,
} from "@/actions/invoices/queries";
import {
  listPayslips,
  type SortOption as PayslipSortOption,
} from "@/actions/team/payslip-queries";
import {
  listClients,
  type SortOption as ClientSortOption,
} from "@/actions/clients/queries";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/lib/clients/constants";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

/** Names the active range as concretely as possible — a single month says
 * "September 2026", a full year says "2026", a wider preset spells out its
 * bounding months, and only an exact custom range falls back to day-level
 * dates. `defaultPreset` is what an absent `range` param means for this
 * module — finance modules default to "this-month" (their page's own
 * default), lifecycle modules like Contracts/Invoices/Payslips default to
 * "all" (they have no on-page date filter to inherit a default from). */
function dateRangeSubtitle(
  params: Record<string, string | undefined>,
  options?: { defaultPreset?: DatePreset; statusLabel?: string },
): string {
  const preset =
    (params.range as DatePreset | undefined) ?? options?.defaultPreset ?? "this-month";
  const range = resolveDateRange(params.range ?? preset, params.from, params.to);
  const parts: string[] = [];

  if (preset === "this-month" && range.from) {
    parts.push(MONTH_YEAR_FORMAT.format(range.from));
  } else if (preset === "this-year" && range.from) {
    parts.push(String(range.from.getFullYear()));
  } else if (preset === "6-months" && range.from) {
    parts.push(`${MONTH_YEAR_FORMAT.format(range.from)} – ${MONTH_YEAR_FORMAT.format(new Date())}`);
  } else if (preset === "custom" && (range.from || range.to)) {
    parts.push(
      `${range.from ? DATE_FORMAT.format(range.from) : "…"} – ${range.to ? DATE_FORMAT.format(range.to) : "…"}`,
    );
  } else {
    parts.push(DATE_PRESET_LABELS[preset] ?? preset);
  }

  if (options?.statusLabel) parts.push(`Status: ${options.statusLabel}`);
  if (params.q) parts.push(`Search: "${params.q}"`);
  return parts.join("  ·  ");
}

export type ReportModuleDef = {
  pageKey: PageKey;
  title: string;
  filename: string;
  fetch(params: Record<string, string | undefined>): Promise<ReportSpec>;
};

const earning: ReportModuleDef = {
  pageKey: "earning",
  title: "EARNING REPORT",
  filename: "earning-report",
  async fetch(params) {
    const dateRange = resolveDateRange(params.range, params.from, params.to);
    const rows = await listEarnings({
      dateRange,
      search: params.q,
      sort: params.sort as FinanceSortOption | undefined,
    });

    let totalAmount = 0;
    let totalTeamPay = 0;
    const reportRows = rows.map((row) => {
      const amount = Number(row.amount);
      const teamPay = Number(row.teamPay);
      totalAmount += amount;
      totalTeamPay += teamPay;
      const reference =
        row.referenceAmount && row.referenceCurrency
          ? `${CURRENCY_SYMBOLS[row.referenceCurrency as ReferenceCurrency]}${Number(row.referenceAmount).toLocaleString()}`
          : null;
      return {
        date: row.date,
        name: row.name,
        amount,
        teamPay,
        netEarning: amount - teamPay,
        reference,
      };
    });

    return {
      title: earning.title,
      subtitle: dateRangeSubtitle(params),
      columns: [
        { key: "date", label: "Date", numFmt: "dd mmm yyyy" },
        { key: "name", label: "Name", flexible: true },
        { key: "amount", label: "Amount", align: "right", numFmt: "#,##0" },
        { key: "teamPay", label: "Team pay", align: "right", numFmt: "#,##0" },
        { key: "netEarning", label: "Net earning", align: "right", numFmt: "#,##0" },
        { key: "reference", label: "Reference", align: "right" },
      ],
      rows: reportRows,
      totals: {
        date: "Total",
        name: null,
        amount: totalAmount,
        teamPay: totalTeamPay,
        netEarning: totalAmount - totalTeamPay,
        reference: null,
      },
      groupByDateKey: "date",
      summaryNoun: "earning",
    };
  },
};

const donations: ReportModuleDef = {
  pageKey: "donations",
  title: "DONATION REPORT",
  filename: "donation-report",
  async fetch(params) {
    const dateRange = resolveDateRange(params.range, params.from, params.to);
    const rows = await listDonations({
      dateRange,
      search: params.q,
      sort: params.sort as FinanceSortOption | undefined,
    });

    let totalAmount = 0;
    const reportRows = rows.map((donation) => {
      const amount = Number(donation.amount);
      totalAmount += amount;
      return { date: donation.date, name: donation.name, amount };
    });

    return {
      title: donations.title,
      subtitle: dateRangeSubtitle(params),
      columns: [
        { key: "date", label: "Date", numFmt: "dd mmm yyyy" },
        { key: "name", label: "Name", flexible: true },
        { key: "amount", label: "Amount", align: "right", numFmt: "#,##0" },
      ],
      rows: reportRows,
      totals: { date: "Total", name: null, amount: totalAmount },
      groupByDateKey: "date",
      summaryNoun: "donations",
    };
  },
};

const expenses: ReportModuleDef = {
  pageKey: "expenses",
  title: "EXPENSE REPORT",
  filename: "expense-report",
  async fetch(params) {
    const dateRange = resolveDateRange(params.range, params.from, params.to);
    const category = EXPENSE_CATEGORIES.includes(params.category as ExpenseCategory)
      ? (params.category as ExpenseCategory)
      : undefined;
    const rows = await listExpenses({
      dateRange,
      search: params.q,
      sort: params.sort as FinanceSortOption | undefined,
      category,
    });

    let totalAmount = 0;
    const reportRows = rows.map((expense) => {
      const amount = Number(expense.amount);
      totalAmount += amount;
      return {
        date: expense.date,
        type: BUCKET_LABELS[expense.category as ExpenseCategory],
        name: expense.name,
        amount,
      };
    });

    return {
      title: expenses.title,
      subtitle: [dateRangeSubtitle(params), category ? `Type: ${BUCKET_LABELS[category]}` : null]
        .filter(Boolean)
        .join("  ·  "),
      columns: [
        { key: "date", label: "Date", numFmt: "dd mmm yyyy" },
        { key: "type", label: "Type" },
        { key: "name", label: "Name", flexible: true },
        { key: "amount", label: "Amount", align: "right", numFmt: "#,##0" },
      ],
      rows: reportRows,
      totals: { date: "Total", type: null, name: null, amount: totalAmount },
      groupByDateKey: "date",
      summaryNoun: "expenses",
    };
  },
};

const contracts: ReportModuleDef = {
  pageKey: "contracts",
  title: "CONTRACTS REPORT",
  filename: "contracts-report",
  async fetch(params) {
    const status = params.status as ContractStatus | undefined;
    const dateRange = resolveDateRange(params.range ?? "all", params.from, params.to);
    const rows = await listContracts({
      search: params.q,
      status,
      sort: params.sort as ContractSortOption | undefined,
      dateRange,
    });

    const reportRows = rows.map((contract) => {
      const currency = contract.currency as PaymentCurrency;
      const milestoneTotal = contract.milestones.reduce(
        (sum, m) => sum + Number(m.amount),
        0,
      );
      const totalAmount =
        contract.paymentType === "MILESTONE"
          ? milestoneTotal
          : Number(contract.amount ?? 0);
      return {
        client: contract.client.name,
        project: contract.projectName,
        startDate: contract.date,
        deadline: contract.deadline,
        payment: PAYMENT_TYPE_LABELS[contract.paymentType as ContractPaymentType],
        amount: formatContractAmount(totalAmount, currency),
        status: CONTRACT_STATUS_LABELS[contract.status as ContractStatus],
      };
    });

    return {
      title: contracts.title,
      subtitle: dateRangeSubtitle(params, {
        defaultPreset: "all",
        statusLabel: status ? CONTRACT_STATUS_LABELS[status] : undefined,
      }),
      columns: [
        { key: "client", label: "Client", flexible: true, flexWeight: 1 },
        { key: "project", label: "Project", flexible: true, flexWeight: 2 },
        { key: "startDate", label: "Start date", numFmt: "dd mmm yyyy" },
        { key: "deadline", label: "Deadline", numFmt: "dd mmm yyyy" },
        { key: "payment", label: "Payment" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "status", label: "Status" },
      ],
      rows: reportRows,
    };
  },
};

const invoices: ReportModuleDef = {
  pageKey: "invoices",
  title: "INVOICES REPORT",
  filename: "invoices-report",
  async fetch(params) {
    const status = params.status as InvoiceStatus | undefined;
    const dateRange = resolveDateRange(params.range ?? "all", params.from, params.to);
    const rows = await listInvoices({
      search: params.q,
      status,
      sort: params.sort as InvoiceSortOption | undefined,
      dateRange,
    });

    const reportRows = rows.map((invoice) => {
      const currency = invoice.currency as PaymentCurrency;
      const total = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
      const balanceDue = total - Number(invoice.discount);
      return {
        number: formatInvoiceNumber(invoice.number),
        client: invoice.client.name,
        bank: invoice.bankAccount.bankName,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        amount: formatContractAmount(balanceDue, currency),
        status: INVOICE_STATUS_LABELS[invoice.status as InvoiceStatus],
      };
    });

    return {
      title: invoices.title,
      subtitle: dateRangeSubtitle(params, {
        defaultPreset: "all",
        statusLabel: status ? INVOICE_STATUS_LABELS[status] : undefined,
      }),
      columns: [
        { key: "number", label: "Invoice" },
        { key: "client", label: "Client", flexible: true },
        { key: "bank", label: "Bank" },
        { key: "issueDate", label: "Issue date", numFmt: "dd mmm yyyy" },
        { key: "dueDate", label: "Due date", numFmt: "dd mmm yyyy" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "status", label: "Status" },
      ],
      rows: reportRows,
    };
  },
};

const payslips: ReportModuleDef = {
  pageKey: "payslips",
  title: "PAYSLIPS REPORT",
  filename: "payslips-report",
  async fetch(params) {
    const dateRange = resolveDateRange(params.range ?? "all", params.from, params.to);
    const rows = await listPayslips({
      search: params.q,
      sort: params.sort as PayslipSortOption | undefined,
      dateRange,
    });

    let totalAmount = 0;
    const reportRows = rows.map((payslip) => {
      const amount = Number(payslip.amount);
      totalAmount += amount;
      return {
        number: formatPayslipNumber(payslip.number),
        teamMember: payslip.teamMember.name,
        project: payslip.contract?.projectName ?? "—",
        period: `${DATE_FORMAT.format(payslip.periodStart)} – ${DATE_FORMAT.format(payslip.periodEnd)}`,
        issueDate: payslip.issueDate,
        amount,
      };
    });

    return {
      title: payslips.title,
      subtitle: dateRangeSubtitle(params, { defaultPreset: "all" }),
      columns: [
        { key: "number", label: "Payslip" },
        { key: "teamMember", label: "Team member", flexible: true, flexWeight: 1 },
        { key: "project", label: "Project", flexible: true, flexWeight: 2 },
        { key: "period", label: "Period" },
        { key: "issueDate", label: "Issue date", numFmt: "dd mmm yyyy" },
        { key: "amount", label: "Amount", align: "right", numFmt: "#,##0" },
      ],
      rows: reportRows,
      totals: {
        number: "Total",
        teamMember: null,
        project: null,
        period: null,
        issueDate: null,
        amount: totalAmount,
      },
      groupByDateKey: "issueDate",
      summaryNoun: "payslips",
    };
  },
};

const clients: ReportModuleDef = {
  pageKey: "clients",
  title: "CLIENTS REPORT",
  filename: "clients-report",
  async fetch(params) {
    const status = params.status as ClientStatus | undefined;
    const dateRange = resolveDateRange(params.range ?? "all", params.from, params.to);
    const rows = await listClients({
      search: params.q,
      status,
      sort: params.sort as ClientSortOption | undefined,
      dateRange,
    });

    const reportRows = rows.map((client) => ({
      name: client.name,
      email: client.email,
      phone: client.phone,
      country: client.country,
      currency: client.currency,
      status: CLIENT_STATUS_LABELS[client.status as ClientStatus],
      createdAt: client.createdAt,
    }));

    return {
      title: clients.title,
      subtitle: dateRangeSubtitle(params, {
        defaultPreset: "all",
        statusLabel: status ? CLIENT_STATUS_LABELS[status] : undefined,
      }),
      columns: [
        { key: "name", label: "Name", flexible: true, flexWeight: 2 },
        { key: "email", label: "Email", flexible: true },
        { key: "phone", label: "Phone" },
        { key: "country", label: "Country" },
        { key: "currency", label: "Currency" },
        { key: "status", label: "Status" },
        { key: "createdAt", label: "Created", numFmt: "dd mmm yyyy" },
      ],
      rows: reportRows,
    };
  },
};

export const REPORT_MODULES: Record<string, ReportModuleDef> = {
  earning,
  donations,
  expenses,
  contracts,
  invoices,
  payslips,
  clients,
};
