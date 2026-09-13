import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SETTINGS_GROUPS } from "@/lib/settings/groups";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-lg font-medium">Settings</h1>
        <p className="text-sm text-muted-foreground">
          App settings for your account on this device.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {SETTINGS_GROUPS.map((group) => (
          <Link key={group.key} href={group.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
