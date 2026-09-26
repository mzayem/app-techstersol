import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity/log";
import {
  INVOICE_REMINDER_INTERVAL_DAYS,
  INVOICE_REMINDER_MAX,
  formatInvoiceNumber,
} from "@/lib/invoices/constants";
import { notifyInvoiceReminder } from "@/lib/mail/notifications/invoices";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderRunResult = {
  sent: number;
  skipped: number;
  failed: number;
};

/** Start of today in UTC — dueDate is a Postgres DATE (stored as UTC
 * midnight), so an invoice is overdue once its due date is before this. */
function startOfTodayUtc(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Sends every overdue-invoice reminder that's currently due. Only
 * invoices with reminders switched on qualify, and each gets at most
 * INVOICE_REMINDER_MAX reminders, spaced INVOICE_REMINDER_INTERVAL_DAYS
 * apart. Safe to run as often as you like (the cron runs it daily) —
 * nothing goes out until the interval has passed. */
export async function sendDueInvoiceReminders(
  now = new Date(),
): Promise<ReminderRunResult> {
  const today = startOfTodayUtc(now);
  const intervalCutoff = new Date(
    now.getTime() - INVOICE_REMINDER_INTERVAL_DAYS * DAY_MS,
  );

  const candidates = await prisma.invoice.findMany({
    where: {
      status: "UNPAID",
      remindersEnabled: true,
      reminderCount: { lt: INVOICE_REMINDER_MAX },
      dueDate: { lt: today },
      OR: [
        { lastReminderAt: null },
        { lastReminderAt: { lte: intervalCutoff } },
      ],
    },
    select: {
      id: true,
      number: true,
      dueDate: true,
      reminderCount: true,
      lastReminderAt: true,
      client: { select: { name: true } },
    },
  });

  const result: ReminderRunResult = { sent: 0, skipped: 0, failed: 0 };

  for (const invoice of candidates) {
    // Claim this reminder slot first (conditional on the count we read),
    // so two overlapping runs can never both email the same reminder.
    const claimed = await prisma.invoice.updateMany({
      where: {
        id: invoice.id,
        status: "UNPAID",
        remindersEnabled: true,
        reminderCount: invoice.reminderCount,
      },
      data: { reminderCount: { increment: 1 }, lastReminderAt: now },
    });
    if (claimed.count === 0) {
      result.skipped++;
      continue;
    }

    const release = () =>
      prisma.invoice.updateMany({
        where: { id: invoice.id, reminderCount: invoice.reminderCount + 1 },
        data: {
          reminderCount: invoice.reminderCount,
          lastReminderAt: invoice.lastReminderAt,
        },
      });

    const daysOverdue = Math.max(
      1,
      Math.round((today.getTime() - invoice.dueDate.getTime()) / DAY_MS),
    );

    try {
      const sent = await notifyInvoiceReminder(invoice.id, daysOverdue);
      if (!sent) {
        // No client email on file — nothing to send, don't burn a slot.
        await release();
        result.skipped++;
        continue;
      }
      result.sent++;
      const nth = invoice.reminderCount + 1;
      await logActivity(null, {
        action: "reminder-sent",
        entityType: "invoice",
        entityId: invoice.id,
        summary: `Sent overdue reminder ${nth}/${INVOICE_REMINDER_MAX} for invoice ${formatInvoiceNumber(invoice.number)} to ${invoice.client.name}`,
        page: "invoices",
      });
    } catch (err) {
      console.error(
        `[reminders] invoice ${formatInvoiceNumber(invoice.number)} failed:`,
        err,
      );
      await release().catch(() => {});
      result.failed++;
    }
  }

  return result;
}
