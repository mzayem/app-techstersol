import type { PaymentCurrency } from "@/lib/clients/constants";

export type BankFieldKey =
  | "accountType"
  | "routingNumber"
  | "accountNumber"
  | "iban"
  | "sortCode"
  | "bsbCode";

export const BANK_FIELD_LABELS: Record<BankFieldKey, string> = {
  accountType: "Account type",
  routingNumber: "Routing number",
  accountNumber: "Account number",
  iban: "IBAN",
  sortCode: "Sort code",
  bsbCode: "BSB code",
};

/** Which extra fields apply for each currency, on top of bank name, account
 * holder name, and SWIFT which every currency requires. */
export const CURRENCY_FIELDS: Record<PaymentCurrency, BankFieldKey[]> = {
  USD: ["accountType", "routingNumber", "accountNumber"],
  EUR: ["iban"],
  PKR: ["accountNumber", "iban"],
  AED: ["iban"],
  GBP: ["accountNumber", "sortCode", "iban"],
  AUD: ["bsbCode", "accountNumber"],
};

/** Fields that, for a given currency, are optional rather than required —
 * e.g. Pakistani banks are always identified by account number; IBAN is a
 * nice-to-have extra, not mandatory. */
export const CURRENCY_OPTIONAL_FIELDS: Partial<Record<PaymentCurrency, BankFieldKey[]>> = {
  PKR: ["iban"],
};
