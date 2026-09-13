import { EmailsClient } from "@/components/mail/emails-client";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  await requirePagePermission("emails");
  return <EmailsClient />;
}
