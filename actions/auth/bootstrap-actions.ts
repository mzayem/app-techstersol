"use server";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminCode } from "@/lib/auth/admin-code";
import { PAGE_KEYS } from "@/lib/rbac/pages";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates the very first account — only works while no AppUser exists
 * yet, and only with the correct admin code. Seeds (or reuses) an "Admin"
 * role with full access to every registry page. Doesn't redirect itself —
 * the caller navigates on success, since redirect() thrown inside a
 * client try/catch is unreliable. */
export async function bootstrapAdmin(formData: FormData) {
  const existingCount = await prisma.appUser.count();
  if (existingCount > 0) {
    throw new Error("Sign-up is closed — ask your administrator for an account");
  }

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const code = str(formData, "adminCode");

  if (!name || !email || !password || !code) {
    throw new Error("All fields are required");
  }
  if (!EMAIL_RE.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  if (!verifyAdminCode(code)) {
    throw new Error("Invalid admin code");
  }

  const { data, error } = await auth.signUp.email({ email, password, name });
  if (error || !data?.user) {
    throw new Error(error?.message ?? "Could not create the account");
  }

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      permissions: {
        create: PAGE_KEYS.map((page) => ({
          page,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        })),
      },
    },
  });

  await prisma.appUser.create({
    data: {
      authUserId: data.user.id,
      email,
      name,
      kind: "DASHBOARD_HANDLER",
      roleId: adminRole.id,
    },
  });
}
