export const CONTRACT_STATUSES = [
  "PROPOSED",
  "ACTIVE",
  "PENDING_PAYMENT",
  "COMPLETED",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  PROPOSED: "Proposed",
  ACTIVE: "Active",
  PENDING_PAYMENT: "Pending payment",
  COMPLETED: "Completed",
};

export const PAYMENT_TYPES = ["PROJECT", "MILESTONE"] as const;
export type ContractPaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<ContractPaymentType, string> = {
  PROJECT: "Project payment",
  MILESTONE: "Milestone payments",
};

export type MilestoneInput = {
  name: string;
  amount: number;
  deadline: string;
};

export function formatContractAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "PKR" ? "en-PK" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
