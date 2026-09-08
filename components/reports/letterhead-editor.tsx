"use client";

import * as React from "react";
import { BoldIcon, DownloadIcon, ListIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { VerifyPasswordDialog } from "@/components/reports/verify-password-dialog";

const DEFAULT_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function todayFormatted() {
  return DEFAULT_DATE_FORMAT.format(new Date()).replace(",", "");
}

export function LetterheadEditor() {
  const [label, setLabel] = React.useState("BUSINESS DECLARATION");
  const [date, setDate] = React.useState(todayFormatted);
  const editorRef = React.useRef<HTMLDivElement>(null);

  const [signOffMode, setSignOffMode] = React.useState<"filled" | "blank">("filled");
  const [name, setName] = React.useState("Muhammad Zayem");
  const [role, setRole] = React.useState("Owner / Software Developer");

  const [includeSignature, setIncludeSignature] = React.useState(false);
  const [signaturePassword, setSignaturePassword] = React.useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);

  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function exec(command: string) {
    document.execCommand(command);
    editorRef.current?.focus();
  }

  function handleSignatureToggle(checked: boolean) {
    if (checked) {
      setPasswordDialogOpen(true);
    } else {
      setIncludeSignature(false);
      setSignaturePassword(null);
    }
  }

  function handleVerified(password: string) {
    setSignaturePassword(password);
    setIncludeSignature(true);
  }

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/reports/letterhead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            date,
            bodyHtml: editorRef.current?.innerHTML ?? "",
            signOff: {
              mode: signOffMode,
              name,
              role,
              includeSignature,
              password: includeSignature ? (signaturePassword ?? undefined) : undefined,
            },
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "Failed to generate the letter");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${(label || "letter").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError("Failed to generate the letter");
      }
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. BUSINESS DECLARATION"
          />
        </Field>
        <Field label="Date">
          <Input value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Letter body">
        <div className="flex items-center gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bold"
            onClick={() => exec("bold")}
          >
            <BoldIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bullet list"
            onClick={() => exec("insertUnorderedList")}
          >
            <ListIcon />
          </Button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-48 rounded-b-md border border-input bg-background p-3 text-sm leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>

      <div className="flex flex-col gap-3 rounded-md border border-input p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Sign-off name &amp; role</p>
            <p className="text-xs text-muted-foreground">
              Filled prints the name and role below the signature line; blank prints empty lines
              for someone to sign by hand.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(signOffMode === "blank" && "font-medium")}>Blank</span>
            <Switch
              checked={signOffMode === "filled"}
              onCheckedChange={(checked) => setSignOffMode(checked ? "filled" : "blank")}
            />
            <span className={cn(signOffMode === "filled" && "font-medium")}>Filled</span>
          </div>
        </div>

        {signOffMode === "filled" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Role">
              <Input value={role} onChange={(e) => setRole(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <div>
            <p className="text-sm font-medium">Add signature &amp; stamp</p>
            <p className="text-xs text-muted-foreground">
              Requires confirming your password every time this is on.
            </p>
          </div>
          <Switch checked={includeSignature} onCheckedChange={handleSignatureToggle} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button onClick={handleDownload} loading={pending}>
          <DownloadIcon />
          Download PDF
        </Button>
      </div>

      <VerifyPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onVerified={handleVerified}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
