import fs from "node:fs";
import path from "node:path";

function readImageAsDataUrl(filename: string): string | null {
  try {
    const buffer = fs.readFileSync(
      path.join(process.cwd(), "public", "images", filename),
    );
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

// Same two assets `lib/team/payslip-pdf.tsx` signs off with — cached once
// per process since they never change at runtime.
let signatureDataUrl: string | null | undefined;
let stampDataUrl: string | null | undefined;

export function getSignatureAssets(): { signature: string | null; stamp: string | null } {
  if (signatureDataUrl === undefined) signatureDataUrl = readImageAsDataUrl("slip_sign.png");
  if (stampDataUrl === undefined) stampDataUrl = readImageAsDataUrl("digital_stamp.png");
  return { signature: signatureDataUrl, stamp: stampDataUrl };
}
