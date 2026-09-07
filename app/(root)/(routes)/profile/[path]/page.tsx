import { AccountView } from "@neondatabase/auth-ui";
import { accountViewPaths } from "@neondatabase/auth-ui/server";

import { ProfileHeader } from "@/components/auth/profile-header";
import { getCurrentAppUser } from "@/lib/rbac/permissions";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(accountViewPaths).map((path) => ({ path }));
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  const appUser = await getCurrentAppUser();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-lg font-medium">Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, security, and sign-in options.
        </p>
      </div>
      {appUser && (
        <ProfileHeader
          name={appUser.name}
          email={appUser.email}
          badge={appUser.role?.name ?? "Dashboard handler"}
        />
      )}
      <AccountView path={path} />
    </div>
  );
}
