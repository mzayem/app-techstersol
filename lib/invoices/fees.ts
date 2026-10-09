/** One fee/tax line as entered in the mark-paid dialog: a fixed amount in
 * the invoice currency, or a percentage of the invoice's balance due. */
export type FeeInput = {
  label: string;
  mode: "amount" | "percent";
  value: number;
};

export type FeeLine = { label: string; amount: number };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Validates the dialog's fee lines (sent as JSON) and resolves each to an
 * amount in the invoice currency. Empty/missing input means no fees. */
export function parseFeeInputs(
  raw: string,
  balanceDue: number,
): { lines: FeeLine[]; total: number } {
  if (!raw) return { lines: [], total: 0 };

  let inputs: unknown;
  try {
    inputs = JSON.parse(raw);
  } catch {
    throw new Error("Couldn't read the fee lines");
  }
  if (!Array.isArray(inputs)) throw new Error("Couldn't read the fee lines");

  const lines = (inputs as FeeInput[]).map((fee) => {
    const label = typeof fee.label === "string" ? fee.label.trim() : "";
    const value = Number(fee.value);
    if (!label) throw new Error("Give every fee a name (e.g. Upwork fee)");
    if (!(value > 0)) throw new Error(`Enter an amount for "${label}"`);
    if (fee.mode === "percent") {
      if (value > 100) throw new Error(`"${label}" can't be over 100%`);
      return { label, amount: round2((balanceDue * value) / 100) };
    }
    return { label, amount: round2(value) };
  });

  const total = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  if (total >= balanceDue) {
    throw new Error("Fees can't add up to the whole invoice amount");
  }
  return { lines, total };
}

/** Fees in PKR. A PKR invoice's fees already are; for any other currency
 * they're converted at the payment's own effective rate — the PKR that
 * arrived divided by what arrived in the invoice currency — so fees and
 * received amount use the same rate. */
export function feesToPkr({
  feesTotal,
  currency,
  balanceDue,
  pkrReceived,
}: {
  feesTotal: number;
  currency: string;
  balanceDue: number;
  pkrReceived: number;
}) {
  if (feesTotal <= 0) return 0;
  if (currency === "PKR") return feesTotal;
  const netInCurrency = balanceDue - feesTotal;
  return netInCurrency > 0
    ? round2((feesTotal * pkrReceived) / netInCurrency)
    : 0;
}
