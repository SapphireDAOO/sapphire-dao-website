import { CONTRACT_API_URL } from "@/constants";

export type UsdPrices = Record<string, number>;

// Mock deployments prefix the real symbol with
// "m" (mUSDC), and the API prices the real asset.
const toApiSymbol = (name: string): string =>
  /^m[A-Z]/.test(name) ? name.slice(1) : name;

type ExchangeRateResponse = {
  from?: string;
  to?: Record<string, number>;
  error?: string;
  reason?: string;
};

/**
 * One `to` parameter per symbol: the API doesn't
 * split a comma-separated list. Empty on failure.
 */
export const fetchUsdPrices = async (
  names: string[],
  signal?: AbortSignal,
): Promise<UsdPrices> => {
  const wanted = Array.from(new Set(names.filter(Boolean)));
  if (wanted.length === 0) return {};

  const namesBySymbol = new Map<string, string[]>();
  for (const name of wanted) {
    const symbol = toApiSymbol(name);
    namesBySymbol.set(symbol, [...(namesBySymbol.get(symbol) ?? []), name]);
  }

  const query = new URLSearchParams({ from: "USD" });
  for (const symbol of namesBySymbol.keys()) query.append("to", symbol);

  try {
    const response = await fetch(
      `${CONTRACT_API_URL}/v1/exchangeRate?${query.toString()}`,
      { signal, cache: "no-store" },
    );
    const payload = (await response.json()) as ExchangeRateResponse;

    if (!response.ok || !payload.to) {
      console.error(
        `exchange rate lookup failed (${response.status})`,
        payload?.error ?? "",
        payload?.reason ?? "",
      );
      return {};
    }

    const prices: UsdPrices = {};
    for (const [symbol, rate] of Object.entries(payload.to)) {
      // A rate of 0 would invert to Infinity; skip rather than poison a total.
      if (typeof rate !== "number" || rate <= 0) continue;
      for (const name of namesBySymbol.get(symbol) ?? [symbol]) {
        prices[name] = 1 / rate;
      }
    }
    return prices;
  } catch (error) {
    console.error("exchange rate lookup failed", error);
    return {};
  }
};
