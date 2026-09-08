"use client";

import * as React from "react";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { verifyCurrentPassword } from "@/actions/reports/verify-password";

/** Confirms the signed-in user's password before letting a caller enable
 * something sensitive (here: embedding the real signature/stamp images
 * into a generated letter). On success, hands the password itself back to
 * the caller — kept in memory only — so the actual PDF request can send it
 * along for the server to re-check independently; this dialog only ever
 * gates the *toggle*, the API route is what actually enforces it. */
export function VerifyPasswordDialog({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (password: string) => void;
}) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) {
      setPassword("");
      setError(null);
    }
  }, [open]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyCurrentPassword(password);
      if (result.ok) {
        onVerified(password);
        onOpenChange(false);
      } else {
        setError(result.error ?? "Incorrect password");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-muted-foreground" />
            Confirm your password
          </DialogTitle>
          <DialogDescription>
            Adding the real signature and stamp to a document requires
            confirming it is really you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            type="password"
            placeholder="Password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" loading={pending} disabled={!password}>
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
