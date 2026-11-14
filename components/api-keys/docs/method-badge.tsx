import { cn } from "cn";

const COLORS = {
  POST: { color: "#22C55E", bg: "rgba(34,197,94,0.16)" },
  DELETE: { color: "#FF5630", bg: "rgba(255,86,48,0.16)" },
  GET: { color: "#00B8D9", bg: "rgba(0,184,217,0.16)" },
} as const;

export type Method = keyof typeof COLORS;

export function MethodBadge({
  method,
  className,
}: {
  method: Method;
  className?: string;
}) {
  const c = COLORS[method];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-md px-2 text-xs font-bold",
        className,
      )}
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {method}
    </span>
  );
}
