import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { OfflineToggle } from "@/components/settings/offline-toggle";
import { SETTINGS_GROUPS } from "@/lib/settings/groups";

export const dynamic = "force-dynamic";

export default function DataOfflineSettingsPage() {
  const group = SETTINGS_GROUPS.find((g) => g.key === "data-offline")!;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>
        <h1 className="text-lg font-medium">{group.title}</h1>
        <p className="text-sm text-muted-foreground">{group.description}</p>
      </div>
      <OfflineToggle />
    </div>
  );
}
