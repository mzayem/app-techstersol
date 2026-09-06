import { redirect } from "next/navigation";
import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  // Public sign-up is disabled — the hosted form has no way to collect the
  // one-time admin code, and every account after the first comes only from
  // an admin's Users page. Send this one path to our own custom page.
  if (path === authViewPaths.SIGN_UP) {
    redirect("/auth/bootstrap");
  }

  return (
    <main className="flex min-h-full grow flex-col items-center justify-center bg-background p-4 text-foreground">
      <AuthView path={path} />
    </main>
  );
}
