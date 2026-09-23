import { prisma } from "@/lib/prisma";

export type StaffNotificationKind = "project" | "chat";

function normalize(email: string) {
  return email.trim().toLowerCase();
}

/** Every staff address that should hear about a client/partner-portal
 * event: ADMIN_NOTIFY_EMAIL always, plus each active DASHBOARD_HANDLER
 * whose role can view contracts and who has opted in via the matching
 * toggle on their profile. Deduped case-insensitively — the admin login
 * usually shares ADMIN_NOTIFY_EMAIL's address, and must only get one copy
 * however their own toggles are set. `exclude` drops addresses that are
 * mailed separately (e.g. the project's partner) from the staff list. */
export async function getStaffNotificationRecipients(
  kind: StaffNotificationKind,
  { exclude = [] }: { exclude?: (string | null | undefined)[] } = {},
): Promise<string[]> {
  const users = await prisma.appUser.findMany({
    where: {
      kind: "DASHBOARD_HANDLER",
      status: "ACTIVE",
      ...(kind === "project"
        ? { projectNotificationsEnabled: true }
        : { chatNotificationsEnabled: true }),
      role: { permissions: { some: { page: "contracts", canView: true } } },
    },
    select: { email: true },
  });

  const skip = new Set(
    exclude.filter((e): e is string => !!e).map(normalize),
  );
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const email of [
    process.env.ADMIN_NOTIFY_EMAIL,
    ...users.map((u) => u.email),
  ]) {
    if (!email?.trim()) continue;
    const key = normalize(email);
    if (seen.has(key) || skip.has(key)) continue;
    seen.add(key);
    recipients.push(email.trim());
  }
  return recipients;
}

/** Where to reach a contract's partner — the email on their Partner profile
 * (the same one payslips go to), falling back to their login's address. */
export async function getPartnerNotificationEmail(
  partnerId: string,
): Promise<string | null> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { email: true, appUser: { select: { email: true } } },
  });
  return partner?.email?.trim() || partner?.appUser?.email || null;
}

/** Same rule for a contract's team member — their TeamMember profile email
 * first, falling back to their login's address. */
export async function getTeamMemberNotificationEmail(
  teamMemberId: string,
): Promise<string | null> {
  const member = await prisma.teamMember.findUnique({
    where: { id: teamMemberId },
    select: { email: true, appUser: { select: { email: true } } },
  });
  return member?.email?.trim() || member?.appUser?.email || null;
}
