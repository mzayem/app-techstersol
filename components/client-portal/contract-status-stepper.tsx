import { Circle, CircleDot, CheckIcon } from "lucide-react";

import {
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
} from "@/lib/contracts/constants";
import { cn } from "@/lib/utils";

/** The normal happy-path progression a proposal walks through. PARTIALLY_PAID
 * shares a step with PENDING_PAYMENT — both mean "billed, payment underway" —
 * so the stepper doesn't grow a parallel branch for it. */
const STEPS = ["PROPOSED", "ACTIVE", "PENDING_PAYMENT", "COMPLETED"] as const;

function stepIndex(status: ContractStatus): number {
  if (status === "UPFRONT_PAYMENT") return STEPS.indexOf("ACTIVE");
  if (status === "PARTIALLY_PAID") return STEPS.indexOf("PENDING_PAYMENT");
  return STEPS.indexOf(status as (typeof STEPS)[number]);
}

export function ContractStatusStepper({ status }: { status: ContractStatus }) {
  if (status === "PAUSED" || status === "CANCELLED") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
          status === "PAUSED"
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "bg-red-500/10 text-red-600 dark:text-red-400",
        )}
      >
        {CONTRACT_STATUS_LABELS[status]}
      </span>
    );
  }

  const current = stepIndex(status);
  const isFullyDone = status === "COMPLETED";

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < current || (isFullyDone && i === current);
        const active = i === current && !isFullyDone;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className="relative flex size-6 shrink-0 items-center justify-center">
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-sky-500/75" />
                )}
                <div
                  className={cn(
                    "relative flex size-6 shrink-0 items-center justify-center rounded-full ring-1",
                    done && "bg-emerald-500 text-white ring-emerald-500",
                    active && "bg-sky-500 text-white ring-sky-500",
                    !done &&
                      !active &&
                      "bg-muted text-muted-foreground ring-foreground/15",
                  )}
                >
                  {done ? (
                    <CheckIcon className="size-3.5" />
                  ) : active ? (
                    <CircleDot className="size-3.5" />
                  ) : (
                    <Circle className="size-3.5" />
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "hidden max-w-16 text-center text-[10px] leading-tight sm:block",
                  i === current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {CONTRACT_STATUS_LABELS[step]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-4 sm:w-8",
                  i < current ? "bg-emerald-500" : "bg-foreground/15",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
