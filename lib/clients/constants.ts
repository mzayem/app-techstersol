export const PAYMENT_CURRENCIES = ["PKR", "USD", "GBP", "EUR", "AUD"] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export const CLIENT_STATUSES = ["ACTIVE", "DEAD"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  DEAD: "Dead",
};
