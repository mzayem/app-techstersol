import { ComingSoon } from "@/components/coming-soon";
import { navMain } from "@/components/nav/nav-data";

export default function OverviewPage() {
  return <ComingSoon title={navMain.title} icon={navMain.icon} />;
}
