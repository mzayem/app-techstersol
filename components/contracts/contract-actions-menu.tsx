"use client";

import {
  ClockIcon,
  FileBadgeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ContractActionsMenu({
  onEdit,
  onDelete,
  onLogHours,
  agreementHref,
  canEdit = true,
  canDelete = true,
}: {
  onEdit: () => void;
  onDelete: () => void;
  /** HOURLY contracts only — opens the logged-hours dialog. */
  onLogHours?: () => void;
  /** Hourly/recurring contracts only — the agreement letter PDF. */
  agreementHref?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  if (!canEdit && !canDelete && !onLogHours && !agreementHref) return null;

  return (
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
          {canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon />
              Update
            </DropdownMenuItem>
          )}
          {onLogHours && (
            <DropdownMenuItem onClick={onLogHours}>
              <ClockIcon />
              Hours &amp; invoicing
            </DropdownMenuItem>
          )}
          {agreementHref && (
            <DropdownMenuItem
              render={
                <a href={agreementHref} target="_blank" rel="noreferrer" />
              }
            >
              <FileBadgeIcon />
              Service agreement
            </DropdownMenuItem>
          )}
          {canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
