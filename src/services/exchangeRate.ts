import { CONTRACT_API_URL } from "@/constants";

// Token prices from the contract API's oracle-backed exchange rate endpoint.

export type UsdPrices = Record<string, number>;

/**
 * The symbol the API's token table knows this token by.
 *
 * Mock deployments prefix the real symbol with "m" - mUSDC is the stand-in for
 * USDC - and the API prices the real asset, so the prefix is dropped on the
 * way out. The API answers keyed by whatever it was asked for, so callers get
 * their own names back rather than having to reverse this.
 */
const toApiSymbol = (name: string): string =>
  /^m[A-Z]/.test(name) ? name.slice(1) : name;

type ExchangeRateResponse = {
  from?: string;
  to?: Record<string, number>;
  error?: string;
  reason?: string;
};

/**
 * USD price per token, keyed by the names passed in.
 *
 * Symbols are passed as one `to` parameter each; the API does not split a
 * comma-separated list. Returns an empty map on failure rather than throwing,
 * so a price outage degrades the figures instead of breaking the page.
 */
export const fetchUsdPrices = async (
  names: string[],
  signal?: AbortSignal,
): Promise<UsdPrices> => {
  const wanted = Array.from(new Set(names.filter(Boolean)));
  if (wanted.length === 0) return {};

  // Several names can share one API symbol, so the lookup is symbol -> names.
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
      // 400 names an unknown symbol, 502 an oracle failure, 503 an oracle that
      // is not configured for this network. None is recoverable here.
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
