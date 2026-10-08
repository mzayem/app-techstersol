export const CONTRACT_STATUSES = [
  "PROPOSED",
  "AWAITING_ADVANCE",
  "UPFRONT_PAYMENT",
  "ACTIVE",
  "PENDING_PAYMENT",
  "PARTIALLY_PAID",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  PROPOSED: "Proposed",
  AWAITING_ADVANCE: "Awaiting advance payment",
  UPFRONT_PAYMENT: "Upfront Recieved",
  ACTIVE: "Active",
  PENDING_PAYMENT: "Pending payment",
  PARTIALLY_PAID: "Partially paid",
  COMPLETED: "Completed",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
};

/** Statuses that take a contract out of every "pending payment" figure
 * (KPI cards, ledger-facing totals, team pending pay) — a paused or
 * cancelled project isn't expected to produce payment activity until
 * it's reactivated, so it shouldn't inflate what's owed. */
export const CONTRACT_STATUSES_EXCLUDED_FROM_PENDING = [
  "PAUSED",
  "CANCELLED",
] as const satisfies readonly ContractStatus[];

export const PAYMENT_TYPES = [
  "PROJECT",
  "MILESTONE",
  "HOURLY",
  "RECURRING",
] as const;
export type ContractPaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<ContractPaymentType, string> = {
  PROJECT: "Project payment",
  MILESTONE: "Milestone payments",
  HOURLY: "Hourly",
  RECURRING: "Recurring",
};

/** Fixed-price structures — the only ones a client or partner can propose
 * from their portal (hourly and recurring contracts are set up by staff). */
export const FIXED_PAYMENT_TYPES = [
  "PROJECT",
  "MILESTONE",
] as const satisfies readonly ContractPaymentType[];

/** Payment structures offered on the Contracts page — RECURRING contracts
 * live on their own page (/projects/recurring). */
export const PROJECT_PAYMENT_TYPES = [
  "PROJECT",
  "MILESTONE",
  "HOURLY",
] as const satisfies readonly ContractPaymentType[];

/** Contracts with no fixed total: they're billed per period (RECURRING) or
 * per logged hour (HOURLY), so they never "complete" by being paid off —
 * every paid invoice books its own team pay / partner share instead. */
export function isOpenEnded(paymentType: string) {
  return paymentType === "HOURLY" || paymentType === "RECURRING";
}

export const BILLING_CYCLES = [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUALLY",
] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/** Hourly work is evaluated weekly or monthly only. */
export const HOURLY_BILLING_CYCLES = [
  "WEEKLY",
  "MONTHLY",
] as const satisfies readonly BillingCycle[];

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUALLY: "Annually",
};

/** "per month", "per week"… for amount labels. */
export const BILLING_CYCLE_UNITS: Record<BillingCycle, string> = {
  WEEKLY: "week",
  MONTHLY: "month",
  QUARTERLY: "quarter",
  ANNUALLY: "year",
};

/** The subset of statuses a RECURRING contract moves through. */
export const RECURRING_STATUSES = [
  "PROPOSED",
  "AWAITING_ADVANCE",
  "ACTIVE",
  "PENDING_PAYMENT",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly ContractStatus[];

export const RECURRING_STATUS_LABELS: Record<
  (typeof RECURRING_STATUSES)[number],
  string
> = {
  PROPOSED: "Draft",
  AWAITING_ADVANCE: "Awaiting advance payment",
  ACTIVE: "Active",
  PENDING_PAYMENT: "Payment due",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Recurring contracts are paid in advance, so a new one starts either as
 * a Draft or as Awaiting advance payment — which invoices the first period
 * straight away; paying that invoice makes it ACTIVE. */
export const RECURRING_CREATE_STATUSES = [
  "PROPOSED",
  "AWAITING_ADVANCE",
] as const satisfies readonly ContractStatus[];

/** Statuses on the Contracts page — AWAITING_ADVANCE is recurring-only. */
export const PROJECT_STATUSES = CONTRACT_STATUSES.filter(
  (s) => s !== "AWAITING_ADVANCE",
);

/** Statuses in which a RECURRING contract keeps generating invoices. */
export const RECURRING_BILLING_STATUSES = [
  "AWAITING_ADVANCE",
  "ACTIVE",
  "PENDING_PAYMENT",
] as const satisfies readonly ContractStatus[];

export function contractStatusLabel(status: string, paymentType: string) {
  if (paymentType === "RECURRING" && status in RECURRING_STATUS_LABELS) {
    return RECURRING_STATUS_LABELS[
      status as keyof typeof RECURRING_STATUS_LABELS
    ];
  }
  return CONTRACT_STATUS_LABELS[status as ContractStatus] ?? status;
}

/** "$500 / month", "$40 / hour", or the fixed total — what a contract is
 * worth in one line, for tables and emails. */
export function contractAmountLabel(contract: {
  paymentType: string;
  amount: unknown;
  currency: string;
  billingCycle?: string | null;
  milestones: { amount: unknown }[];
}) {
  const amount = Number(contract.amount ?? 0);
  if (contract.paymentType === "HOURLY") {
    return `${formatContractAmount(amount, contract.currency)} / hour`;
  }
  if (contract.paymentType === "RECURRING") {
    const unit = contract.billingCycle
      ? BILLING_CYCLE_UNITS[contract.billingCycle as BillingCycle]
      : "period";
    return `${formatContractAmount(amount, contract.currency)} / ${unit}`;
  }
  return formatContractAmount(
    contractRevenueBasis({
      paymentType: contract.paymentType as ContractPaymentType,
      amount: contract.amount,
      milestones: contract.milestones,
    }),
    contract.currency,
  );
}

/** Only meaningful on a partnered contract — FIXED means teamPayAmount is
 * typed directly (same as a non-partnered contract), PERCENTAGE means it's
 * derived from workCostPercent × revenue at save time. */
export const WORK_COST_MODES = ["FIXED", "PERCENTAGE"] as const;
export type ContractWorkCostMode = (typeof WORK_COST_MODES)[number];

export const WORK_COST_MODE_LABELS: Record<ContractWorkCostMode, string> = {
  FIXED: "Fixed",
  PERCENTAGE: "Percentage",
};

export type MilestoneInput = {
  name: string;
  amount: number;
  deadline: string;
};

/** A contract's total billable value — the single PROJECT amount, or the
 * sum of its milestones. Stable the instant a contract is fully paid off,
 * regardless of how many invoices it took to get there, which is why it's
 * the revenue figure markInvoicePaid's profit-split calc uses. For an
 * open-ended contract (see isOpenEnded) there's no total, so this is its
 * per-unit amount (per billing cycle, or per hour) — callers that need a
 * fixed total must skip open-ended contracts. */
export function contractRevenueBasis(contract: {
  paymentType: ContractPaymentType;
  amount: unknown;
  milestones: { amount: unknown }[];
}): number {
  return contract.paymentType === "MILESTONE"
    ? contract.milestones.reduce((sum, m) => sum + Number(m.amount), 0)
    : Number(contract.amount ?? 0);
}

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
