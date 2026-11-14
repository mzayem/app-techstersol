import { ApiDocsView } from "@/components/api-keys/api-docs-view";

export const dynamic = "force-dynamic";

export default function ApiDocsPage() {
  return <ApiDocsView backHref="/admin/api-keys" backLabel="API Keys" />;
}
