import type { PaymentCurrency } from "@/lib/clients/constants";
import type {
  BillingCycle,
  ContractPaymentType,
  ContractStatus,
} from "@/lib/contracts/constants";
import type { listContracts } from "@/actions/contracts/queries";
import type { ContractListItem } from "@/components/contracts/contract-table";

type ListedContract = Awaited<ReturnType<typeof listContracts>>[number];

/** listContracts row → the plain shape the contract table/dialog take
 * (Decimals to numbers), shared by the Contracts and Recurring pages. */
export function toContractListItem(contract: ListedContract): ContractListItem {
  const milestones = contract.milestones.map((m) => ({
    name: m.name,
    amount: Number(m.amount),
    deadline: m.deadline,
  }));
  const amount = contract.amount ? Number(contract.amount) : null;
  const totalAmount =
    contract.paymentType === "MILESTONE"
      ? milestones.reduce((sum, m) => sum + m.amount, 0)
      : (amount ?? 0);

  return {
    id: contract.id,
    number: contract.number,
    clientId: contract.clientId,
    clientName: contract.client.name,
    clientEmail: contract.client.email,
    date: contract.date,
    deadline: contract.deadline,
    projectName: contract.projectName,
    description: contract.description,
    currency: contract.currency as PaymentCurrency,
    paymentType: contract.paymentType as ContractPaymentType,
    amount,
    status: contract.status as ContractStatus,
    teamMemberId: contract.teamMemberId,
    teamPayAmount: contract.teamPayAmount
      ? Number(contract.teamPayAmount)
      : null,
    statusEmailsEnabled: contract.statusEmailsEnabled,
    chatNotificationsEnabled: contract.chatNotificationsEnabled,
    partnerId: contract.partnerId,
    workCostMode: contract.workCostMode,
    workCostPercent: contract.workCostPercent
      ? Number(contract.workCostPercent)
      : null,
    partnerSharePercent: contract.partnerSharePercent
      ? Number(contract.partnerSharePercent)
      : null,
    billingCycle: contract.billingCycle as BillingCycle | null,
    bankAccountId: contract.bankAccountId,
    invoiceDueDays: contract.invoiceDueDays,
    terms: contract.terms,
    nextInvoiceDate: contract.nextInvoiceDate,
    unbilledHours: contract.unbilledHours,
    milestones,
    projectExpenses: contract.projectExpenses.map((e) => ({
      id: e.id,
      date: e.date,
      name: e.name,
      amount: Number(e.amount),
      currency: e.currency as PaymentCurrency,
      pkrAmount: Number(e.pkrAmount),
    })),
    totalAmount,
    paidAmount: contract.paidAmount,
  };
}
