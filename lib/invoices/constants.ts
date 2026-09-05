export const INVOICE_STATUSES = ["UNPAID", "PAID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
};

/** First invoice number issued by this system; each new invoice increments
 * from the highest existing number. */
export const INVOICE_NUMBER_START = 300;

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
