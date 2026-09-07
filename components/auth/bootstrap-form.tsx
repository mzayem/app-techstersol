"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bootstrapAdmin } from "@/actions/auth/bootstrap-actions";

export function BootstrapForm() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await bootstrapAdmin(formData);
        router.push("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <form action={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Create the admin account</h1>
        <p className="text-sm text-muted-foreground">
          One-time setup — this only works while no account exists yet.
        </p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input name="name" required placeholder="Full name" disabled={pending} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Email</span>
        <Input
          type="email"
          name="email"
          required
          placeholder="name@example.com"
          disabled={pending}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Password</span>
        <Input
          type="password"
          name="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          disabled={pending}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Admin code</span>
        <Input
          type="password"
          name="adminCode"
          required
          placeholder="Setup code"
          disabled={pending}
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" loading={pending}>
        {pending ? "Creating…" : "Create admin account"}
      </Button>
    </form>
  );
}
