import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";

export type SortOption =
  "bank-asc" | "bank-desc" | "currency-asc" | "newest" | "oldest";

export type ListFilters = {
  search?: string;
  currency?: PaymentCurrency;
  sort?: SortOption;
};

function orderBy(sort: SortOption | undefined) {
  switch (sort) {
    case "bank-desc":
      return { bankName: "desc" as const };
    case "currency-asc":
      return { currency: "asc" as const };
    case "oldest":
      return { createdAt: "asc" as const };
    case "newest":
      return { createdAt: "desc" as const };
    case "bank-asc":
    default:
      return { bankName: "asc" as const };
  }
}

export async function listBankAccounts(filters: ListFilters) {
  return prisma.bankAccount.findMany({
    where: {
      currency: filters.currency,
      OR: filters.search
        ? [
            { bankName: { contains: filters.search, mode: "insensitive" } },
            {
              accountHolderName: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
          ]
        : undefined,
    },
    orderBy: orderBy(filters.sort),
  });
}
