import { createHash, timingSafeEqual } from "crypto";

/** The one-time bootstrap code gating the very first account. Verified
 * against a plaintext-free hash stored in env — the plaintext itself is
 * never in the codebase. */
export function verifyAdminCode(code: string): boolean {
  const expected = process.env.ADMIN_SETUP_CODE_HASH;
  if (!expected || !code) return false;

  const actual = createHash("sha256").update(code).digest("hex");
  const actualBuf = Buffer.from(actual, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (actualBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(actualBuf, expectedBuf);
}
