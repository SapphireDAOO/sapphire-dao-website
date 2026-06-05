// Display formatting for the metric cards. These format already-computed
// values (USD figures and counts) for presentation only.

/** Compact USD, e.g. 2_400_000 -> "$2.4M", 48_200 -> "$48.2K". */
export const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

/** Grouped integer, e.g. 1247 -> "1,247". */
export const formatCount = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

/** Signed percentage, e.g. 12.5 -> "+12.5%", -2.3 -> "-2.3%". */
export const formatPercent = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

/** Placeholder shown before a value is available. */
export const METRIC_PLACEHOLDER = "—";
