// Invoices are priced in USD. The contract API only prices tokens, so other
// currencies wait for a fiat source; add them here with their rates.
export const FIAT_CURRENCIES = ["USD"] as const;

export type FiatCurrency = (typeof FIAT_CURRENCIES)[number];

/** Units of each currency per 1 USD. */
export type FiatRates = Partial<Record<FiatCurrency, number>>;

export const FIAT_RATES: FiatRates = { USD: 1 };
