/** First payslip number issued by this system; each new payslip increments
 * from the highest existing number. */
export const PAYSLIP_NUMBER_START = 100;

export function formatPayslipNumber(number: number) {
  return `PS-${String(number).padStart(5, "0")}`;
}
