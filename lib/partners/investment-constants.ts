/** First number issued for a partner investment slip; each new one
 * increments from the highest existing number. Kept in its own "PI-"
 * series so it never collides with payslip numbers (lib/partners/constants.ts's
 * "PP-" series) or team payslips' "PS-" series. */
export const PARTNER_INVESTMENT_NUMBER_START = 100;

export function formatPartnerInvestmentNumber(number: number) {
  return `PI-${String(number).padStart(5, "0")}`;
}

export const INVESTMENT_METHOD_LABELS = {
  PENDING_PAYMENT: "Pending payment",
  CASH: "Cash",
  ONLINE: "Online",
} as const;
