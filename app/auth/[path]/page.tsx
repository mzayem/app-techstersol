import Image from "next/image";
import { redirect } from "next/navigation";
import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";

import { AuthErrorToast } from "@/components/auth/auth-error-toast";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

const ERROR_MESSAGES: Record<string, string> = {
  unregistered:
    "That Google account isn't registered here. Ask your admin to add you first.",
};

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { path } = await params;
  const { error } = await searchParams;

  // Public sign-up is disabled — the hosted form has no way to collect the
  // one-time admin code, and every account after the first comes only from
  // an admin's Users page. Send this one path to our own custom page.
  if (path === authViewPaths.SIGN_UP) {
    redirect("/auth/bootstrap");
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background p-4 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-128 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 size-96 rounded-full bg-primary/10 blur-3xl"
      />

      {error && ERROR_MESSAGES[error] && (
        <AuthErrorToast message={ERROR_MESSAGES[error]} />
      )}

      <div className="relative flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/images/icon.webp"
            alt=""
            width={121}
            height={80}
            className="h-10 w-auto"
          />
          <div className="flex flex-col items-center gap-1">
            <span className="uppercase font-medium text-xl tracking-tight">
              Techster<span className="font-bold">sol</span>
            </span>
            <p className="text-sm text-muted-foreground">
              Sign in to your internal dashboard
            </p>
          </div>
        </div>

        <AuthView path={path} className="w-full" />
      </div>
    </main>
  );
}
