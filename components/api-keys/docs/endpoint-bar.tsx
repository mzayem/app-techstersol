"use client";

import { CopyButton } from "./copy-button";
import { MethodBadge, type Method } from "./method-badge";

export function EndpointBar({
  method,
  path,
  copyText,
}: {
  method: Method;
  path: string;
  /** Full text copied (defaults to the path). */
  copyText?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
      <MethodBadge method={method} />
      <code className="min-w-0 flex-1 truncate font-mono text-sm">{path}</code>
      <CopyButton text={copyText ?? path} />
    </div>
  );
}

export function BaseUrlChip({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-3">
      <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
        Base URL
      </span>
      <code className="font-mono text-xs">{url}</code>
      <CopyButton text={url} />
    </div>
  );
}
