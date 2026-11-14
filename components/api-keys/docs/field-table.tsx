import type { ReactNode } from "react";

const TH =
  "px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase";

export type Field = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

export function FieldTable({ fields }: { fields: Field[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className={TH}>Field</th>
            <th className={TH}>Type</th>
            <th className={TH}>Required</th>
            <th className={TH}>Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-t border-dashed">
              <td className="px-3 py-2.5 align-top font-mono text-xs font-medium">
                {f.name}
              </td>
              <td className="px-3 py-2.5 align-top text-muted-foreground">
                {f.type}
              </td>
              <td className="px-3 py-2.5 align-top">
                {f.required ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Required
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Optional
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 align-top text-muted-foreground">
                {f.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type Column = { header: string; className?: string };

export function SimpleTable({
  columns,
  rows,
}: {
  columns: Column[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={TH}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-dashed">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={
                    columns[j]?.className ??
                    "px-3 py-2.5 align-top text-muted-foreground"
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
