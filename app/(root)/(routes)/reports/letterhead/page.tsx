import { LetterheadEditor } from "@/components/reports/letterhead-editor";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function LetterheadPage() {
  await requirePagePermission("reports-letterhead");

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Letterhead</h1>
        <p className="text-sm text-muted-foreground">
          Write a letter on company letterhead and download it as a PDF.
        </p>
      </div>

      <LetterheadEditor />
    </div>
  );
}
