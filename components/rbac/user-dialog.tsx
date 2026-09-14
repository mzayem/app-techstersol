"use client";

import * as React from "react";
import { MailIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  createClientUser,
  createDashboardUser,
  createPartnerUser,
  createTeamUser,
  deleteAppUser,
  sendCredentialsEmail,
  updateAppUser,
} from "@/actions/rbac/user-actions";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

export type RoleOption = { id: string; name: string };
export type TeamMemberOption = { id: string; name: string };
export type ClientOption = { id: string; name: string };
export type PartnerOption = { id: string; name: string };
type UserKind = "DASHBOARD_HANDLER" | "TEAM" | "CLIENT" | "PARTNER";
type UserStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED";

export type EditableUser = {
  id: string;
  name: string;
  email: string;
  kind: UserKind;
  status: UserStatus;
  roleId: string | null;
  teamMemberId: string | null;
  partnerId: string | null;
  clientIds: string[];
};

export function UserDialog({
  roles,
  teamMembers,
  clients,
  partners,
  user,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  roles: RoleOption[];
  teamMembers: TeamMemberOption[];
  clients: ClientOption[];
  partners: PartnerOption[];
  user?: EditableUser;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!user;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [kind, setKind] = React.useState<UserKind>(user?.kind ?? "DASHBOARD_HANDLER");
  const [status, setStatus] = React.useState<UserStatus>(user?.status ?? "ACTIVE");
  const [roleId, setRoleId] = React.useState(user?.roleId ?? "");
  const [teamMemberId, setTeamMemberId] = React.useState(user?.teamMemberId ?? "");
  const [partnerId, setPartnerId] = React.useState(user?.partnerId ?? "");
  const [clientId, setClientId] = React.useState(user?.clientIds[0] ?? "");
  const [profileMode, setProfileMode] = React.useState<"single" | "multiple">(
    (user?.clientIds.length ?? 0) > 1 ? "multiple" : "single",
  );
  const [clientIds, setClientIds] = React.useState<string[]>(
    user?.clientIds.length ? user.clientIds : [""],
  );

  function resetFields() {
    setKind("DASHBOARD_HANDLER");
    setStatus("ACTIVE");
    setRoleId("");
    setTeamMemberId("");
    setPartnerId("");
    setClientId("");
    setProfileMode("single");
    setClientIds([""]);
  }

  function updateClientRow(index: number, value: string) {
    setClientIds((rows) => rows.map((row, i) => (i === index ? value : row)));
  }

  function addClientRow() {
    setClientIds((rows) => [...rows, ""]);
  }

  function removeClientRow(index: number) {
    setClientIds((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateAppUser(user.id, formData);
        } else if (kind === "DASHBOARD_HANDLER") {
          await createDashboardUser(formData);
        } else if (kind === "TEAM") {
          await createTeamUser(formData);
        } else if (kind === "PARTNER") {
          await createPartnerUser(formData);
        } else {
          await createClientUser(formData);
        }
        if (!isEdit) {
          formRef.current?.reset();
          resetFields();
        }
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          Add user
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Add user"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">User type</span>
            <Select
              value={kind}
              onValueChange={(v) => v && setKind(v as UserKind)}
              disabled={isEdit}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DASHBOARD_HANDLER">Dashboard handler</SelectItem>
                <SelectItem value="TEAM">Team member login</SelectItem>
                <SelectItem value="PARTNER">Partner login</SelectItem>
                <SelectItem value="CLIENT">Client login</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Name</span>
            <Input name="name" required placeholder="Full name" defaultValue={user?.name} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Email</span>
            <Input
              type="email"
              name="email"
              required
              placeholder="name@example.com"
              defaultValue={user?.email}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Status</span>
            <Select value={status} onValueChange={(v) => v && setStatus(v as UserStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="status" value={status} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">
              {isEdit ? "New password" : "Password"}
            </span>
            <Input
              type="password"
              name="password"
              required={!isEdit}
              minLength={8}
              placeholder={isEdit ? "Leave blank to keep current password" : "At least 8 characters"}
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
          ) : kind === "TEAM" ? (
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
          ) : kind === "PARTNER" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Partner</span>
              <Combobox
                value={partnerId}
                onValueChange={setPartnerId}
                options={partners.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Select partner"
                searchPlaceholder="Search partners…"
                emptyText="No partners found — create one first."
              />
              <input type="hidden" name="partnerId" value={partnerId} />
            </label>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Client profile(s)</span>
              <div className="inline-flex w-fit overflow-hidden rounded-md ring-1 ring-input">
                <Button
                  type="button"
                  size="sm"
                  variant={profileMode === "single" ? "default" : "ghost"}
                  className="rounded-none"
                  onClick={() => setProfileMode("single")}
                >
                  Single profile
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={profileMode === "multiple" ? "default" : "ghost"}
                  className="rounded-none"
                  onClick={() => setProfileMode("multiple")}
                >
                  Multiple profiles
                </Button>
              </div>

              {profileMode === "single" ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <Combobox
                    value={clientId}
                    onValueChange={setClientId}
                    options={clients.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Select client"
                    searchPlaceholder="Search clients…"
                    emptyText="No clients available — every client already has a login."
                  />
                  <input type="hidden" name="clientId" value={clientId} />
                </label>
              ) : (
                <div className="flex flex-col gap-2">
                  {clientIds.map((rowClientId, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Combobox
                        value={rowClientId}
                        onValueChange={(v) => updateClientRow(index, v ?? "")}
                        options={clients
                          .filter((c) => c.id === rowClientId || !clientIds.includes(c.id))
                          .map((c) => ({ value: c.id, label: c.name }))}
                        placeholder={`Profile ${index + 1}`}
                        searchPlaceholder="Search clients…"
                        emptyText="No clients available."
                        className="flex-1"
                      />
                      {rowClientId && <input type="hidden" name="clientId" value={rowClientId} />}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove profile"
                        disabled={clientIds.length === 1}
                        onClick={() => removeClientRow(index)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addClientRow}>
                    <PlusIcon />
                    Add another profile
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UserRowActions({
  user,
  roles,
  teamMembers,
  clients,
  partners,
}: {
  user: EditableUser;
  roles: RoleOption[];
  teamMembers: TeamMemberOption[];
  clients: ClientOption[];
  partners: PartnerOption[];
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [sending, startSending] = React.useTransition();

  function confirmSendCredentials() {
    startSending(async () => {
      try {
        await sendCredentialsEmail(user.id);
        toast.add({ title: `New credentials sent to ${user.email}`, type: "success" });
        setSendOpen(false);
      } catch (e) {
        toast.add({
          title: e instanceof Error ? e.message : "Couldn't send credentials",
          type: "error",
        });
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit user"
        onClick={() => setEditOpen(true)}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Send credentials email"
        onClick={() => setSendOpen(true)}
      >
        <MailIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete user"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2Icon />
      </Button>
      <UserDialog
        roles={roles}
        teamMembers={teamMembers}
        clients={clients}
        partners={partners}
        user={user}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <AlertDialog
        open={sendOpen}
        onOpenChange={(next) => {
          if (!sending) setSendOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send new credentials to {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This generates a brand-new password for this login, replacing the current one, and
              emails a one-time view link to {user.email}. Their old password stops working
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" disabled={sending} />}>
              Cancel
            </AlertDialogClose>
            <Button loading={sending} onClick={confirmSendCredentials}>
              {sending ? "Sending…" : "Send new credentials"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`user "${user.name}"`}
        onDelete={deleteAppUser.bind(null, user.id)}
      />
    </>
  );
}
