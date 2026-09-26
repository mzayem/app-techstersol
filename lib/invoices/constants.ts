export const INVOICE_STATUSES = ["UNPAID", "PAID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
};

/** First invoice number issued by this system; each new invoice increments
 * from the highest existing number. */
export const INVOICE_NUMBER_START = 300;

/** Default gap between issue date and due date for a new invoice. */
export const DEFAULT_DUE_DAYS = 3;

export function formatInvoiceNumber(number: number) {
  return `#${String(number).padStart(5, "0")}`;
}

export function formatInvoiceFileNumber(number: number) {
  return String(number).padStart(5, "0");
}

/** Fixed company details rendered on every invoice PDF. */
export const COMPANY_INFO = {
  name: "Techstersol",
  addressLines: ["Bahawalpur, Pakistan"],
  website: "www.techstersol.com",
  email: "zayem@techstersol.com",
  phone: "(+92) 306 6940981",
  wise: {
    handle: "@muhammadz3692",
    email: "mzayemazam@gmail.com",
    name: "Muhammad Zayem",
  },
};

export const INVOICE_TERMS =
  "Please share screenshot with invoice number. Don't forget to collect paid e-invoice.";

/** Overdue-invoice reminders (only for invoices with reminders switched
 * on): the first goes out once the due date has passed, then one every
 * INVOICE_REMINDER_INTERVAL_DAYS, stopping after INVOICE_REMINDER_MAX. */
export const INVOICE_REMINDER_MAX = 3;
export const INVOICE_REMINDER_INTERVAL_DAYS = 7;

/** Reads an invoice number out of a search string — "#00312", "00312",
 * "312" and "INV-312" all mean invoice 312. Null when it isn't a number. */
export function parseInvoiceNumberQuery(query: string): number | null {
  const digits = query.trim().replace(/^(#|inv-?)/i, "");
  if (!/^\d{1,9}$/.test(digits)) return null;
  return Number(digits);
}
