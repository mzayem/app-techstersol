"use client";

import * as React from "react";
import { MailIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { sendContractEmail, sendInvoiceEmail, sendPayslipEmail } from "@/actions/mail/actions";

type Attachable = { kind: "contract"; id: string } | { kind: "invoice"; id: string } | { kind: "payslip"; id: string };

/** Drop-in "send email" button + dialog for a contract/invoice/payslip
 * row. There's no message box — it always sends that record's own details
 * (a contract's status/deadline/amount, or an invoice/payslip's PDF), the
 * same content the automatic notifications use, just triggered by hand
 * and to whatever address you confirm here. */
export function SendEmailDialog({
  defaultTo,
  record,
  disabled = false,
  disabledReason,
}: {
  defaultTo: string;
  record: Attachable;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState(defaultTo);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleSend() {
    setError(null);
    startTransition(async () => {
      try {
        if (record.kind === "contract") await sendContractEmail(to, record.id);
        else if (record.kind === "invoice") await sendInvoiceEmail(to, record.id);
        else await sendPayslipEmail(to, record.id);
        toast.add({ title: `Email sent to ${to}`, type: "success" });
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't send email");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Send email"
            disabled={disabled}
            title={disabled ? disabledReason : undefined}
          />
        }
      >
        <MailIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send email</DialogTitle>
          <DialogDescription>
            {record.kind === "contract"
              ? "Sends this project's details."
              : `Sends this ${record.kind}'s details with the PDF attached.`}
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">To</span>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com"
          />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button loading={pending} onClick={handleSend}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
