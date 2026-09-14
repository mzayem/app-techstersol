import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type { ContractPaymentType, ContractStatus } from "@/lib/contracts/constants";
import { getRatesToPkr } from "@/lib/fx/rates";
import { invoicedAmountsByLine, remainingKey } from "@/actions/invoices/queries";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export type PartnerMonthlyPoint = { month: string; amount: number };
export type PartnerClientRevenue = { clientId: string; clientName: string; amountPkr: number };

export type PartnerOverview = {
  activeProjects: number;
  completedProjects: number;
  /** Money that actually left the company for this partner — sourced from
   * PartnerPayment rows that already have a payslip attached, since those
   * are the ones with real paperwork issued (mirrors why the team portal
   * reads TeamPayment instead of Earning.teamPay: it's traceable to one
   * person, not a lump ledger figure). */
  paidThisYearPkr: number;
  /** Accrued but not yet paid out on paper: booked at contract-completion
   * time (source: AUTO_COMPLETION) but not yet linked to an issued
   * payslip. Unlike the team portal's pending figure, this is exact, not
   * an estimate — a partner has a real attributable PartnerPayment row the
   * moment a partnered contract completes. */
  pendingPkr: number;
  /** Last 12 months of PartnerPayment activity, oldest first — feeds the
   * partner's own earnings-over-time area chart. */
  monthlyEarnings: PartnerMonthlyPoint[];
  /** Revenue breakdown for clients this partner brought in
   * (Client.broughtByPartnerId), converted to PKR with a same-day FX
   * estimate purely so the donut's segments are comparable across
   * currencies — this is a rough breakdown, not an accounting figure. */
  revenueByClient: PartnerClientRevenue[];
};

export async function getPartnerOverview(partnerId: string): Promise<PartnerOverview> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  const chartStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [contracts, paidThisYear, pending, recentPayments, broughtInClients, rates] =
    await Promise.all([
      prisma.contract.findMany({
        where: { partnerId },
        select: { status: true },
      }),
      prisma.partnerPayment.aggregate({
        where: { partnerId, partnerPayslipId: { not: null }, date: { gte: yearStart, lte: yearEnd } },
        _sum: { amount: true },
      }),
      prisma.partnerPayment.aggregate({
        where: { partnerId, source: "AUTO_COMPLETION", partnerPayslipId: null },
        _sum: { amount: true },
      }),
      prisma.partnerPayment.findMany({
        where: { partnerId, date: { gte: chartStart } },
        select: { date: true, amount: true },
      }),
      prisma.client.findMany({
        where: { broughtByPartnerId: partnerId },
        select: {
          id: true,
          name: true,
          contracts: {
            select: {
              paymentType: true,
              amount: true,
              currency: true,
              milestones: { select: { amount: true } },
            },
          },
        },
      }),
      getRatesToPkr(),
    ]);

  const activeProjects = contracts.filter(
    (c) => c.status !== "COMPLETED" && c.status !== "CANCELLED",
  ).length;
  const completedProjects = contracts.filter((c) => c.status === "COMPLETED").length;

  const monthMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    monthMap.set(monthKey(d), 0);
  }
  for (const payment of recentPayments) {
    const key = monthKey(payment.date);
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) ?? 0) + Number(payment.amount));
    }
  }
  const monthlyEarnings = Array.from(monthMap.entries()).map(([month, amount]) => ({
    month,
    amount,
  }));

  const revenueByClient = broughtInClients
    .map((client) => {
      const amountPkr = client.contracts.reduce((sum, contract) => {
        const revenue =
          contract.paymentType === "PROJECT"
            ? Number(contract.amount ?? 0)
            : contract.milestones.reduce((s, m) => s + Number(m.amount), 0);
        const rate = rates[contract.currency as PaymentCurrency] ?? 1;
        return sum + revenue * rate;
      }, 0);
      return { clientId: client.id, clientName: client.name, amountPkr };
    })
    .filter((c) => c.amountPkr > 0)
    .sort((a, b) => b.amountPkr - a.amountPkr);

  return {
    activeProjects,
    completedProjects,
    paidThisYearPkr: Number(paidThisYear._sum.amount ?? 0),
    pendingPkr: Number(pending._sum.amount ?? 0),
    monthlyEarnings,
    revenueByClient,
  };
}

export type PartnerContract = {
  id: string;
  projectName: string;
  description: string | null;
  clientId: string;
  clientName: string;
  /** Masked to null unless the admin has flipped the per-client visibility
   * toggle on (Client.phoneVisibleToPartner/emailVisibleToPartner) — the
   * partner portal never bypasses this, even for a client the partner
   * themselves brought in. */
  clientPhone: string | null;
  clientEmail: string | null;
  date: Date;
  deadline: Date;
  currency: PaymentCurrency;
  paymentType: ContractPaymentType;
  amount: number | null;
  status: ContractStatus;
  milestones: { id: string; name: string; amount: number; deadline: Date }[];
};

/** This partner's own profit-share projects (Contract.partnerId === them) —
 * the "Projects" page and the overview's contracts table both read from
 * this. */
export async function listPartnerContracts(partnerId: string): Promise<PartnerContract[]> {
  const contracts = await prisma.contract.findMany({
    where: { partnerId },
    select: {
      id: true,
      projectName: true,
      description: true,
      date: true,
      deadline: true,
      currency: true,
      paymentType: true,
      amount: true,
      status: true,
      milestones: { select: { id: true, name: true, amount: true, deadline: true } },
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          phoneVisibleToPartner: true,
          emailVisibleToPartner: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return contracts.map((c) => ({
    id: c.id,
    projectName: c.projectName,
    description: c.description,
    clientId: c.client.id,
    clientName: c.client.name,
    clientPhone: c.client.phoneVisibleToPartner ? c.client.phone : null,
    clientEmail: c.client.emailVisibleToPartner ? c.client.email : null,
    date: c.date,
    deadline: c.deadline,
    currency: c.currency as PaymentCurrency,
    paymentType: c.paymentType as ContractPaymentType,
    amount: c.amount === null ? null : Number(c.amount),
    status: c.status as ContractStatus,
    milestones: c.milestones.map((m) => ({ ...m, amount: Number(m.amount) })),
  }));
}

export type PartnerClientOption = { id: string; name: string; currency: PaymentCurrency };

/** Clients this partner has already brought in (Client.broughtByPartnerId)
 * — the "pick an existing client" half of the new-contract flow. A brand
 * new client is created separately via createPartnerClient. */
export async function listPartnerClientOptions(
  partnerId: string,
): Promise<PartnerClientOption[]> {
  const clients = await prisma.client.findMany({
    where: { broughtByPartnerId: partnerId, status: "ACTIVE" },
    select: { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
  });
  return clients.map((c) => ({ ...c, currency: c.currency as PaymentCurrency }));
}

export async function listPartnerPayslips(partnerId: string) {
  return prisma.partnerPayslip.findMany({
    where: { partnerId },
    include: { contract: { select: { projectName: true } } },
    orderBy: { issueDate: "desc" },
  });
}

export type PartnerInvoice = {
  id: string;
  clientName: string;
  number: number;
  currency: PaymentCurrency;
  issueDate: Date;
  dueDate: Date;
  status: "UNPAID" | "PAID";
  total: number;
  balanceDue: number;
};

/** Invoices tied to at least one of this partner's own contracts — a
 * client may have other contracts (not partnered, or partnered to someone
 * else), so this filters through the invoice/contract join rather than by
 * client alone. */
export async function listPartnerInvoices(partnerId: string): Promise<PartnerInvoice[]> {
  const contracts = await prisma.contract.findMany({
    where: { partnerId },
    select: { id: true },
  });
  const contractIds = contracts.map((c) => c.id);
  if (contractIds.length === 0) return [];

  const invoices = await prisma.invoice.findMany({
    where: { contracts: { some: { contractId: { in: contractIds } } } },
    select: {
      id: true,
      number: true,
      currency: true,
      discount: true,
      issueDate: true,
      dueDate: true,
      status: true,
      client: { select: { name: true } },
      items: { select: { amount: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  return invoices.map((invoice) => {
    const total = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      id: invoice.id,
      clientName: invoice.client.name,
      number: invoice.number,
      currency: invoice.currency as PaymentCurrency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status as "UNPAID" | "PAID",
      total,
      balanceDue: total - Number(invoice.discount),
    };
  });
}

export type PartnerInvoiceLineOption = {
  contractId: string;
  milestoneId: string | null;
  clientId: string;
  currency: PaymentCurrency;
  label: string;
  remainingAmount: number;
};

export type PartnerInvoiceSources = {
  clients: { id: string; name: string }[];
  lineOptions: PartnerInvoiceLineOption[];
  bankAccounts: { id: string; currency: PaymentCurrency; bankName: string; accountHolderName: string }[];
};

/** Data for the partner's own "new invoice" dialog — same shape as the
 * dashboard's listInvoiceSources, but every contract/milestone line is
 * scoped to Contract.partnerId === this partner, so a partner can never
 * invoice a project that isn't theirs. */
export async function listPartnerInvoiceSources(partnerId: string): Promise<PartnerInvoiceSources> {
  const contracts = await prisma.contract.findMany({
    where: { partnerId, status: { not: "COMPLETED" } },
    select: {
      id: true,
      clientId: true,
      projectName: true,
      currency: true,
      paymentType: true,
      amount: true,
      client: { select: { id: true, name: true } },
      milestones: { select: { id: true, name: true, amount: true } },
    },
    orderBy: { date: "desc" },
  });

  const invoiced = await invoicedAmountsByLine(contracts.map((c) => c.id));

  const clientsById = new Map<string, { id: string; name: string }>();
  for (const contract of contracts) clientsById.set(contract.client.id, contract.client);

  const lineOptions: PartnerInvoiceLineOption[] = contracts.flatMap(
    (contract): PartnerInvoiceLineOption[] => {
      if (contract.paymentType === "PROJECT") {
        const total = contract.amount ? Number(contract.amount) : 0;
        const remaining = total - (invoiced.get(remainingKey(contract.id, null)) ?? 0);
        if (remaining <= 0.01) return [];
        return [
          {
            contractId: contract.id,
            milestoneId: null,
            clientId: contract.clientId,
            currency: contract.currency as PaymentCurrency,
            label: contract.projectName,
            remainingAmount: remaining,
          },
        ];
      }
      return contract.milestones.flatMap((milestone): PartnerInvoiceLineOption[] => {
        const remaining =
          Number(milestone.amount) - (invoiced.get(remainingKey(contract.id, milestone.id)) ?? 0);
        if (remaining <= 0.01) return [];
        return [
          {
            contractId: contract.id,
            milestoneId: milestone.id,
            clientId: contract.clientId,
            currency: contract.currency as PaymentCurrency,
            label: `${contract.projectName} — ${milestone.name}`,
            remainingAmount: remaining,
          },
        ];
      });
    },
  );

  const bankAccounts = await prisma.bankAccount.findMany({
    select: { id: true, currency: true, bankName: true, accountHolderName: true },
    orderBy: { bankName: "asc" },
  });

  return {
    clients: Array.from(clientsById.values()),
    lineOptions,
    bankAccounts: bankAccounts.map((b) => ({ ...b, currency: b.currency as PaymentCurrency })),
  };
}
