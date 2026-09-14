import { redirect } from "next/navigation";

// The single "Reports" page (tab strip) split into separate sidebar pages —
// each tab is now its own PageKey so access can be granted per role
// individually (see lib/rbac/pages.ts). This bare /reports URL just sends
// anyone with an old bookmark/link on to the first one.
export default function ReportsIndexPage() {
  redirect("/reports/audit");
}
