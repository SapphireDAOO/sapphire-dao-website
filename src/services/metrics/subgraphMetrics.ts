// Subgraph side of the hybrid metric flow: fetch the source-of-truth snapshot
// for the first-section metrics and convert per-token raw amounts to USD at
// read time against a globally-cached token price.
//
// NOTE: intentionally NOT implemented yet. The query strings, window-boundary
// math, and the call surface the UI depends on are all defined here; the actual
// network fetch + USD conversion is left as a TODO so the page can be wired up
// end-to-end first.

import { ONE_DAY_MS } from "@/constants";
import type { MetricsSnapshot } from "./types";

const SECONDS_PER_DAY = ONE_DAY_MS / 1000;

class NotImplementedError extends Error {
  constructor(what: string, chainId: number) {
    super(`${what} is not implemented yet (chainId ${chainId})`);
    this.name = "NotImplementedError";
  }
}

/**
 * Day-aligned window boundaries (unix seconds) so each bound lands on a daily
 * bucket edge, per rev/first-section-metrics.md:
 *   dayMark = now - (now % 86400)
 */
export const getWindowBounds = (nowSeconds = Math.floor(Date.now() / 1000)) => {
  const dayMark = nowSeconds - (nowSeconds % SECONDS_PER_DAY);
  return {
    now: nowSeconds,
    dayMark,
    sevenDaysAgo: dayMark - 7 * SECONDS_PER_DAY,
    fourteenDaysAgo: dayMark - 14 * SECONDS_PER_DAY,
    thirtyDaysAgo: dayMark - 30 * SECONDS_PER_DAY,
    sixtyDaysAgo: dayMark - 60 * SECONDS_PER_DAY,
  };
};

/** % change vs. the prior window, guarding against an empty prior window. */
export const percentChange = (
  current: number,
  prior: number,
): number | null => {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
};

/**
 * Current market price (USD) for each held token, keyed by lowercased token id.
 * Cache globally and reuse across every metric in a render pass — the frontend
 * must not issue a price call per metric.
 *
 * TODO: implement (call the chosen third-party price service, cache by cadence).
 */
export const fetchTokenPricesUsd = async (
  chainId: number,
): Promise<Record<string, number>> => {
  throw new NotImplementedError("fetchTokenPricesUsd", chainId);
};

/**
 * Build the first-section metric snapshot from the subgraph.
 *
 * Implementation outline (TODO):
 *  1. bounds = getWindowBounds()
 *  2. load token decimals via PAYMENT_TOKENS_QUERY and prices via
 *     fetchTokenPricesUsd(chainId) (cached once per render pass).
 *  3. Total Volume: run VOLUME_WINDOW_QUERY for the current and prior 30-day
 *     windows; Σ dailyVolume per token, convert to USD, sum; changePct via
 *     percentChange(W_curr, W_prior).
 *  4. Total Fees Paid: same windowed pattern with FEES_WINDOW_QUERY /
 *     totalFeePaid.
 *  5. Total Escrow Balance: ESCROW_WINDOW_QUERY → running sum per token for the
 *     live total; day-over-day change from the last two daily buckets.
 *  6. Total Invoices Paid: INVOICES_PAID_WINDOW_QUERY → latest cumulative minus
 *     the cumulative at the window start, for the current and prior 7-day
 *     windows.
 *
 * Use the per-chain urql client: client(chainId).query(QUERY, vars).toPromise().
 */
export const fetchMetricsSnapshot = async (
  chainId: number,
): Promise<MetricsSnapshot> => {
  throw new NotImplementedError("fetchMetricsSnapshot", chainId);
};
