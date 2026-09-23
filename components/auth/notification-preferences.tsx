"use client";

import * as React from "react";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import {
  updateNotificationPreference,
  type NotificationPreference,
} from "@/actions/profile/notification-actions";

const OPTIONS: {
  field: NotificationPreference;
  label: string;
  description: string;
}[] = [
  {
    field: "projectNotificationsEnabled",
    label: "New project notifications",
    description:
      "Email me when a client or partner submits a new project from their portal.",
  },
  {
    field: "chatNotificationsEnabled",
    label: "Chat notifications",
    description: "Email me when a client posts a message in a project chat.",
  },
];

export function NotificationPreferences({
  initial,
  isAdminNotifyAddress,
}: {
  initial: Record<NotificationPreference, boolean>;
  /** This login's email is ADMIN_NOTIFY_EMAIL, which receives every alert
   * anyway — the toggles can't add a second copy, so say so. */
  isAdminNotifyAddress: boolean;
}) {
  const [values, setValues] = React.useState(initial);
  const [pending, setPending] = React.useState<NotificationPreference | null>(
    null,
  );

  async function toggle(field: NotificationPreference, enabled: boolean) {
    setValues((v) => ({ ...v, [field]: enabled }));
    setPending(field);
    try {
      await updateNotificationPreference(field, enabled);
    } catch (err) {
      setValues((v) => ({ ...v, [field]: !enabled }));
      toast.add({
        title:
          err instanceof Error ? err.message : "Couldn't save your preference",
        type: "error",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 ring-1 ring-foreground/10">
      <div>
        <h2 className="text-base font-medium">Email notifications</h2>
        <p className="text-sm text-muted-foreground">
          {isAdminNotifyAddress
            ? "Your address is the admin notification inbox, so you already get every alert below, once, whatever these are set to."
            : "Get an email when something happens on the projects you can access."}
        </p>
      </div>
      {OPTIONS.map((option) => (
        <div
          key={option.field}
          className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 ring-1 ring-foreground/10"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          </div>
          <Switch
            checked={values[option.field]}
            onCheckedChange={(checked) => toggle(option.field, checked)}
            disabled={pending === option.field}
          />
        </div>
      ))}
    </div>
  );
}
