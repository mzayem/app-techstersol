import { ApiDocsView } from "@/components/api-keys/api-docs-view";

export const dynamic = "force-dynamic";

export default function ApiDocsSettingsPage() {
  return (
    <ApiDocsView
      backHref="/settings/api-credentials"
      backLabel="API Credentials"
    />
  );
}
