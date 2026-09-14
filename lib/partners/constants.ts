/** First payslip number issued to a partner; each new one increments from
 * the highest existing number. Mirrors lib/team/constants.ts's
 * PAYSLIP_NUMBER_START, kept in its own "PP-" series so partner and team
 * payslip numbers never collide. */
export const PARTNER_PAYSLIP_NUMBER_START = 100;

export function formatPartnerPayslipNumber(number: number) {
  return `PP-${String(number).padStart(5, "0")}`;
}
