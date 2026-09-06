"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getRatesToPkr } from "@/lib/fx/rates";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatWeekRange, mondayOf, sundayOf } from "@/lib/team/work-diary";
import { checkPermission, getCurrentAppUser } from "@/lib/rbac/permissions";

/** Reachable from both the admin dashboard (role-gated, any team member)
 * and the team portal (a TEAM login may only ever touch their own
 * entries) — so this checks whichever rule applies instead of redirecting
 * like requirePagePermission does. `ownerTeamMemberId` is the entry's
 * actual owner: the submitted teamMemberId for a create, or the existing
 * row's for an update/delete (never trust the form for those). */
async function requireWorkDiaryWriteAccess(
  action: "create" | "edit" | "delete",
  ownerTeamMemberId: string,
) {
  const appUser = await getCurrentAppUser();
  if (!appUser) throw new Error("Not signed in");

  if (appUser.kind === "TEAM") {
    if (appUser.teamMember?.id !== ownerTeamMemberId) {
      throw new Error("You can only manage your own work diary");
    }
    return appUser.authUserId;
  }

  if (!checkPermission(appUser, "work-diary", action)) {
    throw new Error("You don't have permission to do this");
  }
  return appUser.authUserId;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const MAX_WEEKLY_HOURS = 168; // 24 * 7 — a sanity ceiling, not a policy

async function readWorkDiaryFields(formData: FormData) {
  const teamMemberId = str(formData, "teamMemberId");
  const weekDate = str(formData, "week");
  const hoursRaw = str(formData, "hours");
  const notes = str(formData, "notes");

  if (!teamMemberId || !weekDate) {
    throw new Error("Team member and week are required");
  }
  const hours = Number(hoursRaw);
  if (!hoursRaw || Number.isNaN(hours) || hours <= 0 || hours > MAX_WEEKLY_HOURS) {
    throw new Error(`Enter a valid number of hours (0–${MAX_WEEKLY_HOURS})`);
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { id: teamMemberId },
    select: { type: true, hourlyRate: true, currency: true },
  });
  if (!teamMember) throw new Error("Selected team member no longer exists");

  const weekStart = mondayOf(new Date(weekDate));
  const weekEnd = sundayOf(weekStart);

  let amount: number | null = null;
  if (teamMember.type === "HOURLY" && teamMember.hourlyRate) {
    const rawAmount = hours * Number(teamMember.hourlyRate);
    const ratesToPkr = await getRatesToPkr();
    const rate = ratesToPkr[teamMember.currency as PaymentCurrency];
    amount = Math.round(rawAmount * rate * 100) / 100;
  }

  return {
    teamMemberId,
    weekStart,
    weekEnd,
    hours,
    amount,
    notes: notes || null,
  };
}

export async function createWorkDiaryEntry(formData: FormData) {
  const teamMemberId = str(formData, "teamMemberId");
  const createdByUserId = await requireWorkDiaryWriteAccess("create", teamMemberId);
  const fields = await readWorkDiaryFields(formData);

  try {
    await prisma.workDiaryEntry.create({ data: { ...fields, createdByUserId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(
        `This team member already has an entry for the week of ${formatWeekRange(
          fields.weekStart,
          fields.weekEnd,
        )} — edit that entry instead`,
      );
    }
    throw e;
  }

  revalidatePath("/team/work-diary");
  revalidatePath("/portal/work-diary");
}

export async function updateWorkDiaryEntry(id: string, formData: FormData) {
  const existing = await prisma.workDiaryEntry.findUniqueOrThrow({
    where: { id },
    select: { teamMemberId: true },
  });
  await requireWorkDiaryWriteAccess("edit", existing.teamMemberId);
  const fields = await readWorkDiaryFields(formData);

  try {
    await prisma.workDiaryEntry.update({ where: { id }, data: fields });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(
        `This team member already has a different entry for the week of ${formatWeekRange(
          fields.weekStart,
          fields.weekEnd,
        )}`,
      );
    }
    throw e;
  }

  revalidatePath("/team/work-diary");
  revalidatePath("/portal/work-diary");
}

export async function deleteWorkDiaryEntry(id: string) {
  const existing = await prisma.workDiaryEntry.findUniqueOrThrow({
    where: { id },
    select: { teamMemberId: true },
  });
  await requireWorkDiaryWriteAccess("delete", existing.teamMemberId);

  await prisma.workDiaryEntry.delete({ where: { id } });

  revalidatePath("/team/work-diary");
  revalidatePath("/portal/work-diary");
}
