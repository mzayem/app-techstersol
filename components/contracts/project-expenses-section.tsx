"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { formatContractAmount } from "@/lib/contracts/constants";
import {
  createProjectExpense,
  deleteProjectExpense,
} from "@/actions/contracts/expenses";

export type ProjectExpenseRow = {
  id: string;
  date: Date;
  name: string;
  amount: number;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

/** Booked to the ledger immediately on add/remove — independent of the
 * contract's own status or invoice payment (see actions/contracts/expenses.ts)
 * — so each row talks to the server directly rather than through the
 * contract form's own submit / offline-sync queue. */
export function ProjectExpensesSection({
  contractId,
  initialExpenses,
  disabled = false,
}: {
  contractId: string;
  initialExpenses: ProjectExpenseRow[];
  disabled?: boolean;
}) {
  const [expenses, setExpenses] = React.useState(initialExpenses);
  const [date, setDate] = React.useState(todayInput());
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  function addExpense() {
    setError(null);
    const formData = new FormData();
    formData.set("date", date);
    formData.set("name", name);
    formData.set("amount", amount);

    startTransition(async () => {
      try {
        const created = await createProjectExpense(contractId, formData);
        setExpenses((rows) => [...rows, created]);
        setName("");
        setAmount("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add expense");
      }
    });
  }

  function removeExpense(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteProjectExpense(id);
        setExpenses((rows) => rows.filter((r) => r.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove expense");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Project expenses</span>
        {expenses.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Total: {formatContractAmount(total, "PKR")}
          </span>
        )}
      </div>

      {expenses.map((row) => (
        <div key={row.id} className="flex items-center gap-2 text-sm">
          <span className="w-28 text-muted-foreground">
            {row.date.toISOString().slice(0, 10)}
          </span>
          <span className="flex-1">{row.name}</span>
          <span className="w-24 text-right">{formatContractAmount(row.amount, "PKR")}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove expense"
            disabled={disabled || pending}
            onClick={() => removeExpense(row.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}

      <div className="flex items-start gap-2">
        <DatePicker className="w-36" value={date} disabled={disabled} onValueChange={setDate} />
        <Input
          placeholder="Name"
          className="flex-1"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount (PKR)"
          className="w-32"
          value={amount}
          disabled={disabled}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || pending || !name.trim() || !amount}
          loading={pending}
          onClick={addExpense}
        >
          <PlusIcon />
          Add
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
