/** Every mutation that can go through enqueueMutation (and be queued for
 * offline replay). Shared by the client (to know which keys exist) and the
 * server-side map in lib/sync/server-actions.ts, which must cover them all. */
export const ACTION_KEYS = [
  "createEarning",
  "updateEarning",
  "deleteEarning",
  "createExpense",
  "updateExpense",
  "deleteExpense",
  "createDonation",
  "updateDonation",
  "deleteDonation",
  "createContract",
  "updateContract",
  "deleteContract",
  "createInvoice",
  "deleteInvoice",
  "createPayslip",
  "deletePayslip",
  "createPartnerPayslip",
  "deletePartnerPayslip",
  "createPartnerInvestment",
  "deletePartnerInvestment",
  "createPartnerInvestmentSpend",
  "deletePartnerInvestmentSpend",
  "createClient",
  "updateClient",
  "deleteClient",
  "createBankAccount",
  "updateBankAccount",
  "deleteBankAccount",
] as const;

export type ActionKey = (typeof ACTION_KEYS)[number];

export function isActionKey(value: string): value is ActionKey {
  return (ACTION_KEYS as readonly string[]).includes(value);
}
