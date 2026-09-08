/** One row per page a Role's permissions can be assigned against. `key`
 * must match the string stored in RolePermission.page and be stable once
 * in use (renaming a key here orphans any existing permission rows for
 * it). `url` is used both for nav filtering and for redirect targets.
 * Overview ("/") isn't in this registry — every dashboard-handler sees it
 * regardless of role, same as before RBAC existed. */
export type PageKey =
  | "clients"
  | "earning"
  | "expenses"
  | "distributions"
  | "donations"
  | "bank-details"
  | "balance-sheet"
  | "contracts"
  | "invoices"
  | "team"
  | "payslips"
  | "work-diary"
  | "reports"
  | "roles"
  | "users";

export type PageRegistryEntry = {
  key: PageKey;
  label: string;
  url: string;
  group: "Clients" | "Account" | "Projects" | "Team" | "Reports" | "Admin";
};

export const PAGE_REGISTRY: PageRegistryEntry[] = [
  { key: "clients", label: "Clients", url: "/clients", group: "Clients" },
  { key: "earning", label: "Earning", url: "/account/earning", group: "Account" },
  { key: "expenses", label: "Expenses", url: "/account/expenses", group: "Account" },
  {
    key: "distributions",
    label: "Distributions",
    url: "/account/distributions",
    group: "Account",
  },
  { key: "donations", label: "Donations", url: "/account/donations", group: "Account" },
  {
    key: "bank-details",
    label: "Bank Details",
    url: "/account/bank-details",
    group: "Account",
  },
  {
    key: "balance-sheet",
    label: "Balance Sheet",
    url: "/account/balance-sheet",
    group: "Account",
  },
  {
    key: "contracts",
    label: "Contracts",
    url: "/projects/contracts",
    group: "Projects",
  },
  { key: "invoices", label: "Invoices", url: "/projects/invoices", group: "Projects" },
  { key: "team", label: "Team Members", url: "/team", group: "Team" },
  { key: "payslips", label: "Payslips", url: "/team/payslips", group: "Team" },
  { key: "work-diary", label: "Work Diary", url: "/team/work-diary", group: "Team" },
  { key: "reports", label: "Reports", url: "/reports", group: "Reports" },
  { key: "roles", label: "Roles", url: "/admin/roles", group: "Admin" },
  { key: "users", label: "Users", url: "/admin/users", group: "Admin" },
];

export const PAGE_KEYS = PAGE_REGISTRY.map((p) => p.key);

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as string[]).includes(value);
}
