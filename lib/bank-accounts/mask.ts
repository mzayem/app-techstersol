/** Fields that identify the account itself (and so are worth hiding on
 * screen). Routing/sort/BSB codes only identify the bank — they're printed
 * on every invoice anyway — so they stay visible. */
export const SENSITIVE_BANK_FIELDS = ["accountNumber", "iban"] as const;
export type SensitiveBankField = (typeof SENSITIVE_BANK_FIELDS)[number];

/** "•••• 1234" — enough to tell accounts apart, not enough to use one. */
export function maskBankNumber(value: string | null): string | null {
  if (!value) return value;
  const compact = value.replace(/\s+/g, "");
  return `•••• ${compact.slice(-4)}`;
}
