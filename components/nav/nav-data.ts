import {
  CalendarDays,
  FileSignature,
  FileText,
  Gift,
  Landmark,
  LayoutDashboard,
  Receipt,
  ReceiptText,
  ScrollText,
  Share2,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

import type { PageKey } from "@/lib/rbac/pages";

export const navMain = {
  title: "Overview",
  url: "/",
  icon: LayoutDashboard,
};

export const navGroups = [
  {
    title: "Clients",
    items: [{ title: "Clients", url: "/clients", icon: Users, key: "clients" as PageKey }],
  },
  {
    title: "Account",
    items: [
      { title: "Earning", url: "/account/earning", icon: TrendingUp, key: "earning" as PageKey },
      { title: "Expenses", url: "/account/expenses", icon: Receipt, key: "expenses" as PageKey },
      {
        title: "Distributions",
        url: "/account/distributions",
        icon: Share2,
        key: "distributions" as PageKey,
      },
      { title: "Donations", url: "/account/donations", icon: Gift, key: "donations" as PageKey },
      {
        title: "Bank Details",
        url: "/account/bank-details",
        icon: Landmark,
        key: "bank-details" as PageKey,
      },
      {
        title: "Balance Sheet",
        url: "/account/balance-sheet",
        icon: ScrollText,
        key: "balance-sheet" as PageKey,
      },
    ],
  },
  {
    title: "Projects",
    items: [
      {
        title: "Contracts",
        url: "/projects/contracts",
        icon: FileSignature,
        key: "contracts" as PageKey,
      },
      {
        title: "Invoices",
        url: "/projects/invoices",
        icon: FileText,
        key: "invoices" as PageKey,
      },
    ],
  },
  {
    title: "Team",
    items: [
      { title: "Team Members", url: "/team", icon: UserCog, key: "team" as PageKey },
      {
        title: "Payslips",
        url: "/team/payslips",
        icon: ReceiptText,
        key: "payslips" as PageKey,
      },
      {
        title: "Work Diary",
        url: "/team/work-diary",
        icon: CalendarDays,
        key: "work-diary" as PageKey,
      },
    ],
  },
  {
    title: "Admin",
    items: [
      { title: "Roles", url: "/admin/roles", icon: ShieldCheck, key: "roles" as PageKey },
      { title: "Users", url: "/admin/users", icon: UsersRound, key: "users" as PageKey },
    ],
  },
];
