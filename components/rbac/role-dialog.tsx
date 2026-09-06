"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { PAGE_REGISTRY } from "@/lib/rbac/pages";
import { createRole, deleteRole, updateRole } from "@/actions/rbac/role-actions";
import { TeamActionsMenu } from "@/components/team/team-actions-menu";
import { DeleteEntryDialog } from "@/components/finance/delete-entry-dialog";

const ACTIONS = ["view", "create", "edit", "delete"] as const;
type Action = (typeof ACTIONS)[number];

const ACTION_LABELS: Record<Action, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

const ACTION_FIELD = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
} as const;

export type RolePermissionEntry = {
  page: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type RoleEntry = {
  id: string;
  name: string;
  permissions: RolePermissionEntry[];
  userCount: number;
};

export function RoleDialog({
  role,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  locked = false,
  onUnlock,
}: {
  role?: RoleEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  locked?: boolean;
  onUnlock?: () => void;
}) {
  const isEdit = !!role;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isEdit ? (openProp ?? false) : internalOpen;
  const setOpen = isEdit ? (onOpenChangeProp ?? (() => {})) : setInternalOpen;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateRole(role.id, formData);
        } else {
          await createRole(formData);
          formRef.current?.reset();
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
          Add role
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit role" : "Add role"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Name</span>
            <Input
              name="name"
              placeholder="e.g. Accountant"
              required
              disabled={locked}
              defaultValue={role?.name}
            />
          </label>

          <div className="max-h-80 overflow-y-auto rounded-md ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Page</th>
                  {ACTIONS.map((action) => (
                    <th key={action} className="px-2 py-2 text-center font-medium">
                      {ACTION_LABELS[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAGE_REGISTRY.map((p) => {
                  const existing = role?.permissions.find((perm) => perm.page === p.key);
                  return (
                    <tr key={p.key} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">{p.label}</td>
                      {ACTIONS.map((action) => (
                        <td key={action} className="px-2 py-1.5 text-center">
                          <Checkbox
                            name={`perm_${p.key}_${action}`}
                            defaultChecked={existing?.[ACTION_FIELD[action]] ?? false}
                            disabled={locked}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            {locked ? (
              <Button
                key="update"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onUnlock?.();
                }}
              >
                Update
              </Button>
            ) : (
              <Button key="save" type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Save role"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RoleRowActions({
  entry,
  children,
}: {
  entry: RoleEntry;
  children: React.ReactNode;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [locked, setLocked] = React.useState(true);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  function openView() {
    setLocked(true);
    setDialogOpen(true);
  }

  function openEdit() {
    setLocked(false);
    setDialogOpen(true);
  }

  return (
    <>
      <TableRow className="cursor-pointer" onClick={openView}>
        {children}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end">
            <TeamActionsMenu onEdit={openEdit} onDelete={() => setDeleteOpen(true)} />
          </div>
        </TableCell>
      </TableRow>
      <RoleDialog
        role={entry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locked={locked}
        onUnlock={() => setLocked(false)}
      />
      <DeleteEntryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryLabel={`role "${entry.name}"`}
        onDelete={deleteRole.bind(null, entry.id)}
      />
    </>
  );
}
