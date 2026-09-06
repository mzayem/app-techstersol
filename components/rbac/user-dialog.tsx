"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDashboardUser, createTeamUser, deleteAppUser } from "@/actions/rbac/user-actions";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type RoleOption = { id: string; name: string };
export type TeamMemberOption = { id: string; name: string };
type UserKind = "DASHBOARD_HANDLER" | "TEAM";

export function UserDialog({
  roles,
  teamMembers,
}: {
  roles: RoleOption[];
  teamMembers: TeamMemberOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [kind, setKind] = React.useState<UserKind>("DASHBOARD_HANDLER");
  const [roleId, setRoleId] = React.useState("");
  const [teamMemberId, setTeamMemberId] = React.useState("");

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (kind === "DASHBOARD_HANDLER") {
          await createDashboardUser(formData);
        } else {
          await createTeamUser(formData);
        }
        formRef.current?.reset();
        setRoleId("");
        setTeamMemberId("");
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Add user
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">User type</span>
            <Select value={kind} onValueChange={(v) => v && setKind(v as UserKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DASHBOARD_HANDLER">Dashboard handler</SelectItem>
                <SelectItem value="TEAM">Team member login</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Name</span>
            <Input name="name" required placeholder="Full name" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Email</span>
            <Input type="email" name="email" required placeholder="name@example.com" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Password</span>
            <Input
              type="password"
              name="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </label>

          {kind === "DASHBOARD_HANDLER" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Role</span>
              <Combobox
                value={roleId}
                onValueChange={setRoleId}
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
                placeholder="Select role"
                searchPlaceholder="Search roles…"
                emptyText="No roles yet — create one first."
              />
              <input type="hidden" name="roleId" value={roleId} />
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Team member</span>
              <Combobox
                value={teamMemberId}
                onValueChange={setTeamMemberId}
                options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
                placeholder="Select team member"
                searchPlaceholder="Search team…"
                emptyText="No team members found."
              />
              <input type="hidden" name="teamMemberId" value={teamMemberId} />
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UserRowActions({ id, name }: { id: string; name: string }) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete user"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2Icon />
      </Button>
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`user "${name}"`}
        onDelete={deleteAppUser.bind(null, id)}
      />
    </>
  );
}
