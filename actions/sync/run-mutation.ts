"use server";

import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { isActionKey } from "@/lib/sync/action-keys";
import { SERVER_ACTIONS } from "@/lib/sync/server-actions";

export type MutationResult = { ok: true } | { ok: false; error: string };

/** Runs one registered data-entry mutation and returns its outcome as data.
 * Next.js replaces the message of any error a server action throws to the
 * client with "Minified React error #441" in production — so validation
 * errors ("Choose a country", "Invalid currency"…) are caught here, on the
 * server, and returned instead. Next's own control-flow errors (the
 * redirect a missing permission triggers) are re-thrown untouched. */
export async function runMutation(
  key: string,
  payload: unknown,
): Promise<MutationResult> {
  if (!isActionKey(key)) {
    return { ok: false, error: "This action is no longer available" };
  }
  try {
    await SERVER_ACTIONS[key](payload);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    // Database-level failures can carry table/column detail — log them,
    // show something safe.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientValidationError ||
      error instanceof Prisma.PrismaClientInitializationError
    ) {
      console.error(`[mutation] ${key} failed:`, error);
      return {
        ok: false,
        error: "Couldn't save — please check the form and try again.",
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
