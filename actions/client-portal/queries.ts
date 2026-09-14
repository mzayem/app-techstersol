import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type {
  ContractPaymentType,
  ContractStatus,
} from "@/lib/contracts/constants";

export type ClientProfileOption = {
  id: string;
  name: string;
  currency: PaymentCurrency;
};

export type ProfileValue<T> = {
  clientId: string;
  clientName: string;
  value: T;
};

export type ClientOverview = {
  totalProjects: number;
  completedProjects: number;
  pendingProjects: number;
  totalProjectsByProfile: ProfileValue<number>[];
  completedProjectsByProfile: ProfileValue<number>[];
  pendingProjectsByProfile: ProfileValue<number>[];
  pendingPaymentByCurrency: Partial<Record<PaymentCurrency, number>>;
  pendingPaymentByProfile: ProfileValue<
    Partial<Record<PaymentCurrency, number>>
  >[];
  nextDueInvoice: {
    number: number;
    dueDate: Date;
    currency: PaymentCurrency;
    amount: number;
    clientName: string;
  } | null;
};

/** From the client's own point of view: a project counts as "pending"
 * unless it's finished or called off — unlike the internal forecasting
 * KPIs, a paused project still reads as pending here, since the client
 * still expects it to resume. Every figure is summed across every active
 * profile linked to the login, with a per-profile breakdown alongside each
 * total for logins with more than one. */
export async function getClientOverview(
  clients: ClientProfileOption[],
): Promise<ClientOverview> {
  const clientIds = clients.map((c) => c.id);
  const nameOf = new Map(clients.map((c) => [c.id, c.name]));

  const [contracts, unpaidInvoices, nextDue] = await Promise.all([
    prisma.contract.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { clientId: { in: clientIds }, status: "UNPAID" },
      select: {
        clientId: true,
        currency: true,
        discount: true,
        items: { select: { amount: true } },
      },
    }),
    prisma.invoice.findFirst({
      where: { clientId: { in: clientIds }, status: "UNPAID" },
      orderBy: { dueDate: "asc" },
      select: {
        clientId: true,
        number: true,
        dueDate: true,
        currency: true,
        discount: true,
        items: { select: { amount: true } },
      },
    }),
  ]);

  const totalProjectsByProfile: ProfileValue<number>[] = [];
  const completedProjectsByProfile: ProfileValue<number>[] = [];
  const pendingProjectsByProfile: ProfileValue<number>[] = [];
  for (const clientId of clientIds) {
    const own = contracts.filter((c) => c.clientId === clientId);
    const completed = own.filter((c) => c.status === "COMPLETED").length;
    const pending = own.filter(
      (c) => c.status !== "COMPLETED" && c.status !== "CANCELLED",
    ).length;
    const clientName = nameOf.get(clientId)!;
    totalProjectsByProfile.push({ clientId, clientName, value: own.length });
    completedProjectsByProfile.push({ clientId, clientName, value: completed });
    pendingProjectsByProfile.push({ clientId, clientName, value: pending });
  }

  const pendingPaymentByCurrency: Partial<Record<PaymentCurrency, number>> = {};
  const pendingPaymentByProfile: ProfileValue<
    Partial<Record<PaymentCurrency, number>>
  >[] = clientIds.map((clientId) => ({
    clientId,
    clientName: nameOf.get(clientId)!,
    value: {},
  }));
  const byProfileMap = new Map(
    pendingPaymentByProfile.map((p) => [p.clientId, p.value]),
  );

  for (const invoice of unpaidInvoices) {
    const total = invoice.items.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    const balance = total - Number(invoice.discount);
    if (balance <= 0.01) continue;
    const currency = invoice.currency as PaymentCurrency;
    pendingPaymentByCurrency[currency] =
      (pendingPaymentByCurrency[currency] ?? 0) + balance;
    const profileValue = byProfileMap.get(invoice.clientId);
    if (profileValue) {
      profileValue[currency] = (profileValue[currency] ?? 0) + balance;
    }
  }

  const nextDueInvoice = nextDue
    ? {
        number: nextDue.number,
        dueDate: nextDue.dueDate,
        currency: nextDue.currency as PaymentCurrency,
        amount:
          nextDue.items.reduce((sum, item) => sum + Number(item.amount), 0) -
          Number(nextDue.discount),
        clientName: nameOf.get(nextDue.clientId) ?? "",
      }
    : null;

  return {
    totalProjects: contracts.length,
    completedProjects: completedProjectsByProfile.reduce(
      (sum, p) => sum + p.value,
      0,
    ),
    pendingProjects: pendingProjectsByProfile.reduce(
      (sum, p) => sum + p.value,
      0,
    ),
    totalProjectsByProfile,
    completedProjectsByProfile,
    pendingProjectsByProfile,
    pendingPaymentByCurrency,
    pendingPaymentByProfile,
    nextDueInvoice,
  };
}

export type MyContract = {
  id: string;
  clientId: string;
  clientName: string;
  projectName: string;
  description: string | null;
  date: Date;
  deadline: Date;
  currency: PaymentCurrency;
  paymentType: ContractPaymentType;
  amount: number | null;
  status: ContractStatus;
  milestones: { id: string; name: string; amount: number; deadline: Date }[];
};

export async function listMyContracts(
  clients: ClientProfileOption[],
  filters: { search?: string; profileClientId?: string } = {},
): Promise<MyContract[]> {
  const clientIds = filters.profileClientId
    ? [filters.profileClientId]
    : clients.map((c) => c.id);
  const nameOf = new Map(clients.map((c) => [c.id, c.name]));

  const contracts = await prisma.contract.findMany({
    where: {
      clientId: { in: clientIds },
      ...(filters.search
        ? {
            OR: [
              {
                projectName: { contains: filters.search, mode: "insensitive" },
              },
              {
                description: { contains: filters.search, mode: "insensitive" },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      clientId: true,
      projectName: true,
      description: true,
      date: true,
      deadline: true,
      currency: true,
      paymentType: true,
      amount: true,
      status: true,
      milestones: {
        select: { id: true, name: true, amount: true, deadline: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return contracts.map((c) => ({
    ...c,
    clientName: nameOf.get(c.clientId) ?? "",
    currency: c.currency as PaymentCurrency,
    paymentType: c.paymentType as ContractPaymentType,
    status: c.status as ContractStatus,
    amount: c.amount === null ? null : Number(c.amount),
    milestones: c.milestones.map((m) => ({ ...m, amount: Number(m.amount) })),
  }));
}

export type MyInvoice = {
  id: string;
  clientId: string;
  clientName: string;
  number: number;
  currency: PaymentCurrency;
  issueDate: Date;
  dueDate: Date;
  status: "UNPAID" | "PAID";
  paidOn: Date | null;
  total: number;
  balanceDue: number;
};

export async function listMyInvoices(
  clients: ClientProfileOption[],
): Promise<MyInvoice[]> {
  const clientIds = clients.map((c) => c.id);
  const nameOf = new Map(clients.map((c) => [c.id, c.name]));

  const invoices = await prisma.invoice.findMany({
    where: { clientId: { in: clientIds } },
    select: {
      id: true,
      clientId: true,
      number: true,
      currency: true,
      discount: true,
      issueDate: true,
      dueDate: true,
      status: true,
      paidOn: true,
      items: { select: { amount: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  return invoices.map((invoice) => {
    const total = invoice.items.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    return {
      id: invoice.id,
      clientId: invoice.clientId,
      clientName: nameOf.get(invoice.clientId) ?? "",
      number: invoice.number,
      currency: invoice.currency as PaymentCurrency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status as "UNPAID" | "PAID",
      paidOn: invoice.paidOn,
      total,
      balanceDue: total - Number(invoice.discount),
    };
  });
}
