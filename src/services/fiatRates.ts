import { CONTRACT_API_URL } from "@/constants";

// Invoices are priced in USD; the rest are shown for reference only.
export const FIAT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
] as const;

export type FiatCurrency = (typeof FIAT_CURRENCIES)[number];

/** Units of each currency per 1 USD. */
export type FiatRates = Partial<Record<FiatCurrency, number>>;

type ExchangeRateResponse = { to?: Record<string, number> };

const fetchRate = async (
  code: FiatCurrency,
  signal?: AbortSignal,
): Promise<number | undefined> => {
  try {
    const response = await fetch(
      `${CONTRACT_API_URL}/v1/exchangeRate?from=USD&to=${code}`,
      { signal, cache: "no-store" },
    );
    if (!response.ok) return undefined;
    const rate = ((await response.json()) as ExchangeRateResponse).to?.[code];
    return typeof rate === "number" && rate > 0 ? rate : undefined;
  } catch {
    return undefined;
  }
};

/**
 * One request per currency: the API refuses a whole query over one
 * symbol it doesn't price. Those it doesn't are left out.
 */
export const fetchFiatRates = async (
  signal?: AbortSignal,
): Promise<FiatRates> => {
  const others = FIAT_CURRENCIES.filter((code) => code !== "USD");
  const found = await Promise.all(
    others.map((code) => fetchRate(code, signal)),
  );

  const rates: FiatRates = { USD: 1 };
  others.forEach((code, index) => {
    if (found[index] !== undefined) rates[code] = found[index];
  });
  return rates;
};
