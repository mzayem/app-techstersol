import {
  FileSignature,
  FileText,
  Gift,
  Landmark,
  LayoutDashboard,
  Receipt,
  ReceiptText,
  Share2,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";

export const navMain = {
  title: "Overview",
  url: "/",
  icon: LayoutDashboard,
};

export const navGroups = [
  {
    title: "Clients",
    items: [{ title: "Clients", url: "/clients", icon: Users }],
  },
  {
    title: "Account",
    items: [
      { title: "Earning", url: "/account/earning", icon: TrendingUp },
      { title: "Expenses", url: "/account/expenses", icon: Receipt },
      { title: "Distributions", url: "/account/distributions", icon: Share2 },
      { title: "Donations", url: "/account/donations", icon: Gift },
      { title: "Bank Details", url: "/account/bank-details", icon: Landmark },
    ],
  },
  {
    title: "Projects",
    items: [
      { title: "Contracts", url: "/projects/contracts", icon: FileSignature },
      { title: "Invoices", url: "/projects/invoices", icon: FileText },
    ],
  },
  {
    title: "Team",
    items: [
      { title: "Team Members", url: "/team", icon: UserCog },
      { title: "Payslips", url: "/team/payslips", icon: ReceiptText },
    ],
  },
];
