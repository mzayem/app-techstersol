import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";

/** Approximate units of each currency per 1 USD — only used if the live FX
 * API is unreachable, so the dashboard still renders instead of crashing.
 * Not actively maintained; real rates always come from the API first. */
const FALLBACK_PER_USD: Record<PaymentCurrency, number> = {
  USD: 1,
  PKR: 280,
  GBP: 0.79,
  EUR: 0.92,
  AUD: 1.54,
  AED: 3.67,
};

/** 1 unit of each supported currency, expressed in PKR. Backed by
 * open.er-api.com — free, no API key, updated daily — cached for an hour
 * via Next's fetch cache. Falls back to a fixed approximate table if the
 * request fails. */
export async function getRatesToPkr(): Promise<Record<PaymentCurrency, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`FX API returned ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    const perUsd = data.rates;
    const pkrPerUsd = perUsd?.PKR;
    if (!perUsd || !pkrPerUsd) throw new Error("FX API response missing PKR rate");

    const rates = {} as Record<PaymentCurrency, number>;
    for (const currency of PAYMENT_CURRENCIES) {
      const unitsPerUsd = perUsd[currency];
      rates[currency] = unitsPerUsd
        ? pkrPerUsd / unitsPerUsd
        : FALLBACK_PER_USD.PKR / FALLBACK_PER_USD[currency];
    }
    return rates;
  } catch {
    const rates = {} as Record<PaymentCurrency, number>;
    for (const currency of PAYMENT_CURRENCIES) {
      rates[currency] = FALLBACK_PER_USD.PKR / FALLBACK_PER_USD[currency];
    }
    return rates;
  }
}
