import {
  FileSignature,
  FileText,
  Gift,
  LayoutDashboard,
  Receipt,
  Share2,
  TrendingUp,
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
    ],
  },
  {
    title: "Projects",
    items: [
      { title: "Contracts", url: "/projects/contracts", icon: FileSignature },
      { title: "Invoices", url: "/projects/invoices", icon: FileText },
    ],
  },
];
