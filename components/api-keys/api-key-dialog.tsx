"use client";

import * as React from "react";
import {
  BanIcon,
  CheckIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";
import {
  createApiKey,
  deleteApiKey,
  revokeApiKey,
} from "@/actions/api-keys/actions";
import { actionErrorMessage } from "@/lib/action-error";
import { addDaysIso, todayIso } from "@/lib/date/iso";
import { submitForm } from "@/lib/form-submit";

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ title: done, type: "success" });
    return true;
  } catch {
    toast.add({ title: "Couldn't copy to clipboard", type: "error" });
    return false;
  }
}

export function ApiKeyDialog() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    // Empty means the key never expires; otherwise it must be tomorrow or later
    // (Pakistan calendar day).
    const expiresAt = String(formData.get("expiresAt") ?? "");
    if (expiresAt && expiresAt < addDaysIso(todayIso(), 1)) {
      setError("Expiry date must be tomorrow or later.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createApiKey(formData);
        setSecret(result.secret);
      } catch (e) {
        setError(actionErrorMessage(e, "Something went wrong"));
      }
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // The secret is gone for good once the dialog closes.
      setSecret(null);
      setCopied(false);
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Issue key
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {secret ? "Copy your API key" : "Issue API key"}
          </DialogTitle>
        </DialogHeader>
        {secret ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              This is the only time the key is shown. Store it in the other
              software now — if it&apos;s lost, revoke it and issue a new one.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs">
                {secret}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy API key"
                onClick={async () => {
                  if (await copyText(secret, "API key copied")) setCopied(true);
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={(event) => submitForm(event, onSubmit)}
            className="flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">
                Software name (shown as the earning&apos;s source)
              </span>
              <Input
                name="name"
                placeholder="e.g. Softifex ERP"
                maxLength={100}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">
                Expires on (optional)
              </span>
              <DatePicker name="expiresAt" placeholder="Never expires" />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" loading={pending}>
                {pending ? "Issuing…" : "Issue key"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeyRowActions({
  id,
  name,
  revoked,
  expired,
  canEdit,
  canDelete,
  children,
}: {
  id: string;
  name: string;
  revoked: boolean;
  expired: boolean;
  canEdit: boolean;
  canDelete: boolean;
  children: React.ReactNode;
}) {
  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const canRevoke = canEdit && !revoked;
  const canRemove = canDelete && (revoked || expired);

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      try {
        await revokeApiKey(id);
        setRevokeOpen(false);
      } catch (e) {
        setError(actionErrorMessage(e, "Something went wrong"));
      }
    });
  }

  return (
    <>
      <TableRow>
        {children}
        <TableCell>
          <div className="flex items-center justify-end">
            {(canRevoke || canRemove) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Open actions menu"
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    {canRevoke && (
                      <DropdownMenuItem onClick={() => setRevokeOpen(true)}>
                        <BanIcon />
                        Revoke
                      </DropdownMenuItem>
                    )}
                    {canRevoke && canRemove && <DropdownMenuSeparator />}
                    {canRemove && (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2Icon />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog
        open={revokeOpen}
        onOpenChange={(next) => {
          if (!pending) {
            setRevokeOpen(next);
            if (!next) setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke &quot;{name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Software using this key will immediately get 401 errors and
              can&apos;t push earnings. This can&apos;t be undone — issue a new
              key to restore access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline" disabled={pending} />}
            >
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              loading={pending}
              onClick={handleRevoke}
            >
              {pending ? "Revoking…" : "Revoke"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`API key "${name}"`}
        onDelete={() => deleteApiKey(id)}
      />
    </>
  );
}
