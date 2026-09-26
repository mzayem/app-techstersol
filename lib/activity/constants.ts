/** Every entityType logActivity is called with, and how the Activity Log
 * page labels it. Keep in sync when instrumenting a new action. */
export const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  client: "Client",
  contract: "Contract",
  "project-expense": "Project expense",
  invoice: "Invoice",
  earning: "Earning",
  expense: "Expense",
  donation: "Donation",
  "bank-account": "Bank account",
  "team-member": "Team member",
  payslip: "Payslip",
  "work-diary": "Work diary",
  partner: "Partner",
  "partner-payslip": "Partner payslip",
  "partner-investment": "Partner investment",
  role: "Role",
  user: "User",
  email: "Email",
};

export function activityEntityLabel(entityType: string) {
  return ACTIVITY_ENTITY_LABELS[entityType] ?? entityType;
}
