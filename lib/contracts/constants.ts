export const CONTRACT_STATUSES = [
  "PROPOSED",
  "UPFRONT_PAYMENT",
  "ACTIVE",
  "PENDING_PAYMENT",
  "PARTIALLY_PAID",
  "COMPLETED",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  PROPOSED: "Proposed",
  UPFRONT_PAYMENT: "Upfront Recieved",
  ACTIVE: "Active",
  PENDING_PAYMENT: "Pending payment",
  PARTIALLY_PAID: "Partially paid",
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

/** Below 10,000 shows the exact amount; at or above it, abbreviates to
 * e.g. "$10K" or "A$1.2M" for scannable headline stats. */
export function formatCompactContractAmount(amount: number, currency: string) {
  if (Math.abs(amount) < 10_000) return formatContractAmount(amount, currency);
  return new Intl.NumberFormat(currency === "PKR" ? "en-PK" : "en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}
