import {
  FileHeart,
  Gift,
  PiggyBank,
  Receipt,
  ShieldPlus,
  type LucideIcon,
} from "lucide-react";

export const REFERENCE_CURRENCIES = ["USD", "GBP", "EUR", "AUD"] as const;
export type ReferenceCurrency = (typeof REFERENCE_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<ReferenceCurrency, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  AUD: "A$",
};

export const EXPENSE_CATEGORIES = [
  "EXPENSE",
  "LIFESTYLE",
  "INVESTMENT",
  "EMERGENCY_FUND",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Bucket = ExpenseCategory | "DONATION";

export const BUCKETS: Bucket[] = [
  "EXPENSE",
  "INVESTMENT",
  "LIFESTYLE",
  "EMERGENCY_FUND",
  "DONATION",
];

/** Share of each earning's net amount that is allocated to a bucket. */
export const DISTRIBUTION_SPLIT: Record<Bucket, number> = {
  EXPENSE: 0.5,
  INVESTMENT: 0.2,
  LIFESTYLE: 0.15,
  EMERGENCY_FUND: 0.1,
  DONATION: 0.05,
};

export const BUCKET_LABELS: Record<Bucket, string> = {
  EXPENSE: "Expenses",
  INVESTMENT: "Investment",
  LIFESTYLE: "Lifestyle",
  EMERGENCY_FUND: "Emergency Fund",
  DONATION: "Donation",
};

export const BUCKET_ICONS: Record<Bucket, LucideIcon> = {
  EXPENSE: Receipt,
  INVESTMENT: PiggyBank,
  LIFESTYLE: FileHeart,
  EMERGENCY_FUND: ShieldPlus,
  DONATION: Gift,
};

export const PKR_FORMATTER = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

export function formatPkr(amount: number) {
  return PKR_FORMATTER.format(amount);
}
