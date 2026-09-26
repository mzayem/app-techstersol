import { prisma } from "@/lib/prisma";
import {
  contractRevenueBasis,
  formatContractAmount,
} from "@/lib/contracts/constants";
import {
  INVOICE_REMINDER_MAX,
  formatInvoiceNumber,
} from "@/lib/invoices/constants";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead "due soon" / "deadline soon" looks. */
export const ATTENTION_WINDOW_DAYS = 7;
/** Rows shown per group on the card; the rest are behind "View all". */
const ROWS_PER_GROUP = 4;

export type AttentionRow = {
  id: string;
  label: string;
  detail: string;
  /** Styled as urgent (red) rather than a heads-up (amber). */
  urgent?: boolean;
};

export type AttentionGroup = {
  key:
    | "overdue-invoices"
    | "due-soon-invoices"
    | "deadlines"
    | "proposals"
    | "ready-to-invoice"
    | "partner-payouts";
  title: string;
  count: number;
  href: string;
  rows: AttentionRow[];
};

export type AttentionAccess = {
  invoices: boolean;
  contracts: boolean;
  partnerPayslips: boolean;
};

function startOfTodayUtc(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function inDays(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function daysAgo(days: number) {
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Everything on the overview's "Needs attention" card — overdue and
 * soon-due invoices, contract deadlines, new proposals, fully-delivered
 * work that still has no invoice, and partner shares nobody has paid out
 * yet. Always all-time (like the pending-payment KPIs), and each group is
 * only loaded if the viewer's role can see the page it links to. Empty
 * groups are dropped, so an empty array means "all clear". */
export async function getAttentionGroups(
  access: AttentionAccess,
  now = new Date(),
): Promise<AttentionGroup[]> {
  const today = startOfTodayUtc(now);
  const windowEnd = new Date(today.getTime() + ATTENTION_WINDOW_DAYS * DAY_MS);

  const [
    unpaidInvoices,
    workingContracts,
    proposals,
    billableContracts,
    payouts,
  ] = await Promise.all([
    access.invoices
      ? prisma.invoice.findMany({
          where: { status: "UNPAID", dueDate: { lte: windowEnd } },
          select: {
            id: true,
            number: true,
            currency: true,
            discount: true,
            dueDate: true,
            remindersEnabled: true,
            reminderCount: true,
            client: { select: { name: true } },
            items: { select: { amount: true } },
          },
          orderBy: [{ dueDate: "asc" }, { number: "asc" }],
        })
      : [],
    access.contracts
      ? prisma.contract.findMany({
          where: {
            status: { in: ["UPFRONT_PAYMENT", "ACTIVE"] },
            deadline: { lte: windowEnd },
          },
          select: {
            id: true,
            projectName: true,
            deadline: true,
            client: { select: { name: true } },
          },
          orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
        })
      : [],
    access.contracts
      ? prisma.contract.findMany({
          where: { status: "PROPOSED" },
          select: {
            id: true,
            projectName: true,
            createdAt: true,
            client: { select: { name: true } },
            partner: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    access.contracts && access.invoices
      ? prisma.contract.findMany({
          where: { status: { in: ["PENDING_PAYMENT", "PARTIALLY_PAID"] } },
          select: {
            id: true,
            projectName: true,
            currency: true,
            paymentType: true,
            amount: true,
            milestones: { select: { amount: true } },
            invoiceItems: { select: { amount: true } },
            client: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : [],
    access.partnerPayslips
      ? prisma.partnerPayment.findMany({
          where: {
            source: "AUTO_COMPLETION",
            partnerPayslipId: null,
            partnerInvestmentId: null,
          },
          select: {
            amount: true,
            date: true,
            partner: { select: { id: true, name: true } },
          },
          orderBy: { date: "asc" },
        })
      : [],
  ]);

  const invoiceTotal = (i: (typeof unpaidInvoices)[number]) =>
    formatContractAmount(
      i.items.reduce((sum, item) => sum + Number(item.amount), 0) -
        Number(i.discount),
      i.currency,
    );

  const overdue = unpaidInvoices.filter((i) => i.dueDate < today);
  const dueSoon = unpaidInvoices.filter((i) => i.dueDate >= today);

  const groups: AttentionGroup[] = [
    {
      key: "overdue-invoices",
      title: "Overdue invoices",
      count: overdue.length,
      href: "/projects/invoices?status=UNPAID&sort=due-asc",
      rows: overdue.map((i) => ({
        id: i.id,
        label: `${formatInvoiceNumber(i.number)} · ${i.client.name}`,
        detail: `${invoiceTotal(i)} · due ${daysAgo(daysBetween(i.dueDate, today))}${
          i.remindersEnabled
            ? ` · ${i.reminderCount}/${INVOICE_REMINDER_MAX} reminders`
            : " · reminders off"
        }`,
        urgent: true,
      })),
    },
    {
      key: "due-soon-invoices",
      title: `Invoices due in the next ${ATTENTION_WINDOW_DAYS} days`,
      count: dueSoon.length,
      href: "/projects/invoices?status=UNPAID&sort=due-asc",
      rows: dueSoon.map((i) => ({
        id: i.id,
        label: `${formatInvoiceNumber(i.number)} · ${i.client.name}`,
        detail: `${invoiceTotal(i)} · due ${inDays(daysBetween(today, i.dueDate))}`,
      })),
    },
    {
      key: "deadlines",
      title: "Project deadlines",
      count: workingContracts.length,
      href: "/projects/contracts?sort=deadline-asc",
      rows: workingContracts.map((c) => {
        const days = daysBetween(today, c.deadline);
        return {
          id: c.id,
          label: `${c.projectName} · ${c.client.name}`,
          detail:
            days < 0
              ? `deadline passed ${daysAgo(-days)}`
              : `due ${inDays(days)}`,
          urgent: days < 0,
        };
      }),
    },
    {
      key: "proposals",
      title: "New project proposals to review",
      count: proposals.length,
      href: "/projects/contracts?status=PROPOSED",
      rows: proposals.map((c) => ({
        id: c.id,
        label: `${c.projectName} · ${c.client.name}`,
        detail: `${c.partner ? `via ${c.partner.name} · ` : ""}submitted ${
          daysBetween(startOfTodayUtc(c.createdAt), today) === 0
            ? "today"
            : daysAgo(daysBetween(startOfTodayUtc(c.createdAt), today))
        }`,
      })),
    },
    (() => {
      const rows = billableContracts.flatMap((c) => {
        const remaining =
          contractRevenueBasis(c) -
          c.invoiceItems.reduce((sum, item) => sum + Number(item.amount), 0);
        return remaining > 0.01
          ? [
              {
                id: c.id,
                label: `${c.projectName} · ${c.client.name}`,
                detail: `${formatContractAmount(remaining, c.currency)} not invoiced yet`,
              },
            ]
          : [];
      });
      return {
        key: "ready-to-invoice" as const,
        title: "Work ready to invoice",
        count: rows.length,
        href: "/projects/invoices",
        rows,
      };
    })(),
    (() => {
      const byPartner = new Map<
        string,
        { name: string; total: number; count: number; oldest: Date }
      >();
      for (const p of payouts) {
        const entry = byPartner.get(p.partner.id) ?? {
          name: p.partner.name,
          total: 0,
          count: 0,
          oldest: p.date,
        };
        entry.total += Number(p.amount);
        entry.count += 1;
        byPartner.set(p.partner.id, entry);
      }
      const rows = [...byPartner.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id, e]) => ({
          id,
          label: e.name,
          detail: `${formatContractAmount(e.total, "PKR")} across ${e.count} project${
            e.count === 1 ? "" : "s"
          } · oldest ${daysAgo(daysBetween(e.oldest, today))}`,
        }));
      return {
        key: "partner-payouts" as const,
        title: "Partner shares waiting for a payslip",
        count: rows.length,
        href: "/partners/payslips",
        rows,
      };
    })(),
  ];

  return groups
    .filter((g) => g.count > 0)
    .map((g) => ({ ...g, rows: g.rows.slice(0, ROWS_PER_GROUP) }));
}
