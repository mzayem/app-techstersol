import { NextResponse } from "next/server";

import {
  checkPermission,
  getActiveClientProfiles,
  getCurrentAppUser,
} from "@/lib/rbac/permissions";
import {
  agreementFilename,
  getAgreementContract,
  renderAgreementPdf,
} from "@/lib/contracts/agreement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The contract's service agreement letter as a PDF — for the dashboard,
 * the contract's own client, and its partner. Never for team logins,
 * since it shows the fee. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const contract = await getAgreementContract(id);
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Not found (not forbidden) for an owned-data mismatch, so a guessed id
  // doesn't confirm another party's contract exists.
  const notFound = NextResponse.json(
    { error: "Contract not found" },
    { status: 404 },
  );
  if (
    appUser.kind === "CLIENT" &&
    !getActiveClientProfiles(appUser).some((c) => c.id === contract.clientId)
  ) {
    return notFound;
  }
  if (
    appUser.kind === "PARTNER" &&
    (!appUser.partner || appUser.partner.id !== contract.partnerId)
  ) {
    return notFound;
  }
  if (appUser.kind === "TEAM") return notFound;
  if (
    appUser.kind === "DASHBOARD_HANDLER" &&
    !checkPermission(appUser, "contracts", "view")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = await renderAgreementPdf(
    contract,
    new URL(request.url).origin,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${agreementFilename(contract)}"`,
    },
  });
}
