import type { ReactNode } from "react";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import { cn } from "cn";

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warning";
  title?: string;
  children: ReactNode;
}) {
  const Icon = variant === "warning" ? AlertTriangleIcon : InfoIcon;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-l-4 p-3 text-sm",
        variant === "warning"
          ? "border-amber-500/30 border-l-amber-500 bg-amber-500/10"
          : "border-sky-500/30 border-l-sky-500 bg-sky-500/10",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          variant === "warning"
            ? "text-amber-600 dark:text-amber-400"
            : "text-sky-600 dark:text-sky-400",
        )}
      />
      <div className="min-w-0 text-muted-foreground">
        {title ? (
          <p className="mb-0.5 font-medium text-foreground">{title}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
