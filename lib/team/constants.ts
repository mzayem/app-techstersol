/** First payslip number issued by this system; each new payslip increments
 * from the highest existing number. */
export const PAYSLIP_NUMBER_START = 100;

export function formatPayslipNumber(number: number) {
  return `PS-${String(number).padStart(5, "0")}`;
}

export const TEAM_MEMBER_TYPES = ["PROJECT_BASED", "HOURLY"] as const;
export type TeamMemberType = (typeof TEAM_MEMBER_TYPES)[number];

export const TEAM_MEMBER_TYPE_LABELS: Record<TeamMemberType, string> = {
  PROJECT_BASED: "Project-based",
  HOURLY: "Hourly",
};
