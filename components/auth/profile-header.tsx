function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0] ?? "?"];
  return chars.join("").toUpperCase();
}

export function ProfileHeader({
  name,
  email,
  badge,
}: {
  name: string;
  email: string;
  badge: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 ring-1 ring-foreground/10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
          <span className="mt-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {badge}
          </span>
        </div>
      </div>
    </div>
  );
}
