import { prisma } from "@/lib/prisma";
import { BootstrapForm } from "@/components/auth/bootstrap-form";

export const dynamic = "force-dynamic";

export default async function BootstrapPage() {
  const existingCount = await prisma.appUser.count();

  return (
    <main className="flex min-h-full grow flex-col items-center justify-center bg-background p-4 text-foreground">
      {existingCount > 0 ? (
        <div className="flex max-w-sm flex-col gap-2 text-center">
          <h1 className="text-lg font-medium">Sign-up is closed</h1>
          <p className="text-sm text-muted-foreground">
            This dashboard doesn&apos;t accept public sign-ups. Ask an
            administrator to create an account for you.
          </p>
        </div>
      ) : (
        <BootstrapForm />
      )}
    </main>
  );
}
