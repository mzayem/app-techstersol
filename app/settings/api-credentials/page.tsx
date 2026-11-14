import { ApiKeysView } from "@/components/api-keys/api-keys-view";

export const dynamic = "force-dynamic";

export default async function ApiCredentialsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <ApiKeysView
      searchParams={await searchParams}
      docsHref="/settings/api-docs"
    />
  );
}
