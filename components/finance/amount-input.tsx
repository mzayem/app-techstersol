"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { evaluateAmountExpression } from "@/lib/finance/expression";

/** True once the typed text has an actual operator in it (not just a
 * leading +/- sign on a plain number), so the live preview only shows up
 * once it's actually useful. */
function hasOperator(raw: string): boolean {
  const stripped = raw.trim().replace(/^=/, "").trim();
  const body = /^[+-]/.test(stripped) ? stripped.slice(1) : stripped;
  return /[+\-*/]/.test(body);
}

/** Amount field that doubles as a tiny calculator — typing an expression
 * like "1223+2341" (an optional leading "=" is stripped, spreadsheet-style)
 * shows the running total in a small hint underneath as you type. The
 * expression itself is submitted as-is; callers resolve it to the final
 * number via `resolveAmountField` before handing the FormData to a server
 * action. */
export function AmountInput({
  name,
  label,
  required = true,
  disabled,
  defaultValue,
  placeholder = "0.00",
}: {
  name: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: number | string;
  placeholder?: string;
}) {
  const [preview, setPreview] = React.useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!hasOperator(raw)) {
      setPreview(null);
      return;
    }
    const result = evaluateAmountExpression(raw);
    setPreview(
      result === null
        ? "Invalid expression"
        : `= ${result.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    );
  }

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="text"
        inputMode="decimal"
        name={name}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        defaultValue={defaultValue ?? ""}
        onChange={handleChange}
      />
      {preview && (
        <span className="text-xs text-muted-foreground">{preview}</span>
      )}
    </label>
  );
}
