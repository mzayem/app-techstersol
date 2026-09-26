"use server";

import { prisma } from "@/lib/prisma";
import { checkPermission, getCurrentAppUser } from "@/lib/rbac/permissions";
import type { PageKey } from "@/lib/rbac/pages";
import { formatContractAmount } from "@/lib/contracts/constants";
import {
  formatInvoiceNumber,
  parseInvoiceNumberQuery,
} from "@/lib/invoices/constants";

export type SearchResult = {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  href: string;
};

const PER_GROUP = 5;

function listHref(path: string, q: string) {
  return `${path}?${new URLSearchParams({ q })}`;
}

/** Backs the Ctrl+K palette. Searches only the record types the viewer's
 * role can view, a handful of matches per type — each result links to its
 * listing pre-filtered to that record (via the listing's own `?q=`), since
 * records don't have standalone detail pages. */
export async function globalSearch(rawQuery: string): Promise<SearchResult[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.kind !== "DASHBOARD_HANDLER") return [];
  const can = (page: PageKey) => checkPermission(appUser, page, "view");
  const contains = { contains: q, mode: "insensitive" as const };
  const invoiceNumber = parseInvoiceNumberQuery(q);

  const [
    clients,
    contracts,
    invoices,
    team,
    partners,
    earnings,
    expenses,
    donations,
    banks,
  ] = await Promise.all([
    can("clients")
      ? prisma.client.findMany({
          where: {
            OR: [{ name: contains }, { email: contains }, { phone: contains }],
          },
          select: { id: true, name: true, email: true, country: true },
          orderBy: { name: "asc" },
          take: PER_GROUP,
        })
      : [],
    can("contracts")
      ? prisma.contract.findMany({
          where: {
            OR: [{ projectName: contains }, { client: { name: contains } }],
          },
          select: {
            id: true,
            projectName: true,
            status: true,
            client: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP,
        })
      : [],
    can("invoices")
      ? prisma.invoice.findMany({
          where: {
            OR: [
              { client: { name: contains } },
              ...(invoiceNumber === null ? [] : [{ number: invoiceNumber }]),
            ],
          },
          select: {
            id: true,
            number: true,
            status: true,
            dueDate: true,
            client: { select: { name: true } },
          },
          orderBy: { number: "desc" },
          take: PER_GROUP,
        })
      : [],
    can("team")
      ? prisma.teamMember.findMany({
          where: { OR: [{ name: contains }, { email: contains }] },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
          take: PER_GROUP,
        })
      : [],
    can("partners")
      ? prisma.partner.findMany({
          where: { OR: [{ name: contains }, { email: contains }] },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
          take: PER_GROUP,
        })
      : [],
    can("earning")
      ? prisma.earning.findMany({
          where: { name: contains },
          select: { id: true, name: true, amount: true, date: true },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: PER_GROUP,
        })
      : [],
    can("expenses")
      ? prisma.expense.findMany({
          where: { name: contains },
          select: { id: true, name: true, amount: true, date: true },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: PER_GROUP,
        })
      : [],
    can("donations")
      ? prisma.donation.findMany({
          where: { name: contains },
          select: { id: true, name: true, amount: true, date: true },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: PER_GROUP,
        })
      : [],
    can("bank-details")
      ? prisma.bankAccount.findMany({
          where: {
            OR: [{ bankName: contains }, { accountHolderName: contains }],
          },
          select: {
            id: true,
            bankName: true,
            accountHolderName: true,
            currency: true,
          },
          orderBy: { bankName: "asc" },
          take: PER_GROUP,
        })
      : [],
  ]);

  const pkr = (amount: unknown) => formatContractAmount(Number(amount), "PKR");
  const day = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);

  return [
    ...clients.map((c) => ({
      id: `client-${c.id}`,
      group: "Clients",
      title: c.name,
      subtitle: [c.email, c.country].filter(Boolean).join(" · "),
      href: listHref("/clients", c.name),
    })),
    ...contracts.map((c) => ({
      id: `contract-${c.id}`,
      group: "Contracts",
      title: c.projectName,
      subtitle: c.client.name,
      href: listHref("/projects/contracts", c.projectName),
    })),
    ...invoices.map((i) => ({
      id: `invoice-${i.id}`,
      group: "Invoices",
      title: `Invoice ${formatInvoiceNumber(i.number)}`,
      subtitle: `${i.client.name} · ${i.status === "PAID" ? "Paid" : `Due ${day(i.dueDate)}`}`,
      href: listHref("/projects/invoices", String(i.number)),
    })),
    ...team.map((m) => ({
      id: `team-${m.id}`,
      group: "Team",
      title: m.name,
      subtitle: m.email ?? undefined,
      href: "/team",
    })),
    ...partners.map((p) => ({
      id: `partner-${p.id}`,
      group: "Partners",
      title: p.name,
      subtitle: p.email ?? undefined,
      href: "/partners",
    })),
    ...earnings.map((e) => ({
      id: `earning-${e.id}`,
      group: "Earnings",
      title: e.name,
      subtitle: `${pkr(e.amount)} · ${day(e.date)}`,
      href: listHref("/account/earning", e.name),
    })),
    ...expenses.map((e) => ({
      id: `expense-${e.id}`,
      group: "Expenses",
      title: e.name,
      subtitle: `${pkr(e.amount)} · ${day(e.date)}`,
      href: listHref("/account/expenses", e.name),
    })),
    ...donations.map((d) => ({
      id: `donation-${d.id}`,
      group: "Donations",
      title: d.name,
      subtitle: `${pkr(d.amount)} · ${day(d.date)}`,
      href: listHref("/account/donations", d.name),
    })),
    ...banks.map((b) => ({
      id: `bank-${b.id}`,
      group: "Bank accounts",
      title: `${b.bankName} — ${b.accountHolderName}`,
      subtitle: b.currency,
      href: listHref("/account/bank-details", b.bankName),
    })),
  ];
}
