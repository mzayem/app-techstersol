"use client";

import { Fragment, type ReactNode } from "react";
import { cn } from "cn";

import { CopyButton } from "./copy-button";

export type CodeLang = "bash" | "json" | "js" | "python" | "http" | "text";

const LABELS: Record<CodeLang, string> = {
  bash: "curl",
  json: "json",
  js: "javascript",
  python: "python",
  http: "http",
  text: "text",
};

const TOKEN_CLASS = {
  key: "text-sky-700 dark:text-sky-300",
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  comment: "italic text-muted-foreground",
} as const;

// Strings first (so numbers/comments inside them are never touched), then
// comments, then numbers. Deliberately small: no grammar, just good-enough.
function tokenRegex(lang: CodeLang) {
  const comment =
    lang === "js"
      ? "\\/\\/.*"
      : lang === "python" || lang === "bash"
        ? "(?<=^|\\s)#.*"
        : null;
  const parts = [
    '"(?:[^"\\\\\\n]|\\\\.)*"',
    ...(comment ? [comment] : []),
    "\\b\\d+(?:\\.\\d+)?\\b",
  ];
  return new RegExp(parts.join("|"), "gm");
}

function highlight(code: string, lang: CodeLang): ReactNode {
  if (lang === "text") return code;
  const re = tokenRegex(lang);
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of code.matchAll(re)) {
    const start = m.index ?? 0;
    const tok = m[0];
    if (start > last) out.push(code.slice(last, start));
    const end = start + tok.length;
    let cls: string;
    if (tok.startsWith('"')) {
      const isKey = /^\s*:/.test(code.slice(end, end + 8));
      cls = isKey ? TOKEN_CLASS.key : TOKEN_CLASS.string;
    } else if (/^\d/.test(tok)) {
      cls = TOKEN_CLASS.number;
    } else {
      cls = TOKEN_CLASS.comment;
    }
    out.push(
      <span key={i++} className={cls}>
        {tok}
      </span>,
    );
    last = end;
  }
  if (last < code.length) out.push(code.slice(last));
  return out.map((n, idx) => <Fragment key={idx}>{n}</Fragment>);
}

export function CodeBlock({
  code,
  lang = "text",
  label,
  title,
  className,
  bare = false,
}: {
  code: string;
  lang?: CodeLang;
  /** Overrides the language label in the header. */
  label?: string;
  /** Small caption shown above the block. */
  title?: string;
  className?: string;
  /** Drop the outer border/radius (used inside CodeTabs). */
  bare?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {title ? (
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
      ) : null}
      <div
        className={cn(
          "overflow-hidden bg-muted/50 dark:bg-black/30",
          bare ? "" : "rounded-lg border",
        )}
      >
        <div className="flex items-center justify-between border-b border-dashed px-3 py-1">
          <span className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label ?? LABELS[lang]}
          </span>
          <CopyButton text={code} />
        </div>
        <pre className="max-h-[560px] overflow-auto p-3 font-mono text-[12.5px] leading-6">
          <code>{highlight(code, lang)}</code>
        </pre>
      </div>
    </div>
  );
}
