// Subgraph side of the hybrid metric flow: fetch the source-of-truth snapshot
// for the first-section metrics. A single batched query pulls 60 days of daily
// buckets in one round-trip; all four metric values are derived on the client.
// Raw token amounts are converted to USD at read time against a globally-cached
// price (see fetchTokenPricesUsd).

import { ONE_DAY_MS, KNOWN_PAYMENT_TOKENS } from "@/constants";
import type {
  EscrowSeriesPoint,
  InvoiceActivityPoint,
  MetricsSnapshot,
  MetricValue,
  VolumeSeriesPoint,
} from "./types";
import { client } from "../graphql/client";
import { METRICS_SNAPSHOT_QUERY } from "../graphql/metricsQueries";

const SECONDS_PER_DAY = ONE_DAY_MS / 1000;
const MICROS_PER_SECOND = 1_000_000;

/** Graph-node Timestamp values are in microseconds. */
const tsToSeconds = (timestamp: string): number =>
  Number(timestamp) / MICROS_PER_SECOND;

// Placeholder prices for the testnet mock tokens, keyed by PaymentToken.name.
// Swap for a real price feed (e.g. CoinGecko, Chainlink) when the dashboard
// graduates from testnet data.
const TESTNET_PRICES_BY_NAME: Record<string, number> = {
  mUSDC: 1,
  USDC: 1,
  wBTC: 60_000,
  WBTC: 60_000,
  ETH: 3_500,
  WETH: 3_500,
};

/**
 * Day-aligned window boundaries (unix seconds) so each bound lands on a daily
 * bucket edge.
 */
export const getWindowBounds = (nowSeconds = Math.floor(Date.now() / 1000)) => {
  const dayMark = nowSeconds - (nowSeconds % SECONDS_PER_DAY);
  return {
    now: nowSeconds,
    dayMark,
    yesterdayMark: dayMark - SECONDS_PER_DAY,
    sevenDaysAgo: dayMark - 7 * SECONDS_PER_DAY,
    fourteenDaysAgo: dayMark - 14 * SECONDS_PER_DAY,
    thirtyDaysAgo: dayMark - 30 * SECONDS_PER_DAY,
    sixtyDaysAgo: dayMark - 60 * SECONDS_PER_DAY,
  };
};

/** % change vs. the prior window, null when the prior window has no activity. */
export const percentChange = (current: number, prior: number): number | null =>
  prior ? ((current - prior) / prior) * 100 : null;

interface TokenMeta {
  decimals: number;
  priceUsd: number;
}

/**
 * Per-token decimals + USD price keyed by lowercased token id. Tokens absent
 * from KNOWN_PAYMENT_TOKENS are skipped on the read path — the constants list
 * is the canonical source for supported tokens.
 */
const tokenMetaByChain = (chainId: number): Map<string, TokenMeta> => {
  const out = new Map<string, TokenMeta>();
  for (const token of KNOWN_PAYMENT_TOKENS[chainId] ?? []) {
    out.set(token.id.toLowerCase(), {
      decimals: token.decimals,
      priceUsd: TESTNET_PRICES_BY_NAME[token.name] ?? 0,
    });
  }
  return out;
};

/**
 * Current USD price for each held token, keyed by lowercased token id.
 * Cache this once per render pass — the read path must not issue a price call
 * per metric.
 */
export const fetchTokenPricesUsd = async (
  chainId: number,
): Promise<Record<string, number>> => {
  const meta = tokenMetaByChain(chainId);
  const out: Record<string, number> = {};
  for (const [id, { priceUsd }] of meta) out[id] = priceUsd;
  return out;
};

interface TokenRef {
  id: string;
}

interface VolumeBucket {
  timestamp: string;
  token: TokenRef;
  dailyVolume: string;
  invoicePaid: string;
}

interface FeeBucket {
  timestamp: string;
  token: TokenRef;
  totalFeePaid: string;
}

interface EscrowBucket {
  timestamp: string;
  token: TokenRef;
  total: string;
}

type InvoiceType = "SIMPLE" | "ADVANCED";

interface InvoiceActivityBucket {
  timestamp: string;
  invoiceType: InvoiceType;
  /** Cumulative paid-invoice count for this processor through this day. */
  totalActivity: string;
}

interface MetricsSnapshotData {
  volumeBuckets: VolumeBucket[];
  feeBuckets: FeeBucket[];
  escrowBuckets: EscrowBucket[];
  invoiceActivityBuckets: InvoiceActivityBucket[];
}

const toUsd = (raw: bigint, decimals: number, priceUsd: number): number => {
  if (!priceUsd) return 0;
  return (Number(raw) / 10 ** decimals) * priceUsd;
};

/** Σ (raw token amount × price) across buckets within [start, end]. */
const sumWindowUsd = <T extends { timestamp: string; token: TokenRef }>(
  buckets: T[],
  start: number,
  end: number,
  amount: (b: T) => string,
  meta: Map<string, TokenMeta>,
): number => {
  let usd = 0;
  for (const b of buckets) {
    const ts = tsToSeconds(b.timestamp);
    if (ts < start || ts > end) continue;
    const m = meta.get(b.token.id.toLowerCase());
    if (!m) continue;
    usd += toUsd(BigInt(amount(b)), m.decimals, m.priceUsd);
  }
  return usd;
};

/**
 * Running USD escrow balance: sum of signed per-day deltas across every bucket
 * with timestamp <= cutoff, converted at the current price per token.
 */
const escrowAtUsd = (
  buckets: EscrowBucket[],
  cutoff: number,
  meta: Map<string, TokenMeta>,
): number => {
  const perToken = new Map<string, bigint>();
  for (const b of buckets) {
    if (tsToSeconds(b.timestamp) > cutoff) continue;
    const id = b.token.id.toLowerCase();
    perToken.set(id, (perToken.get(id) ?? BigInt(0)) + BigInt(b.total));
  }
  let usd = 0;
  for (const [id, sum] of perToken) {
    const m = meta.get(id);
    if (!m) continue;
    usd += toUsd(sum, m.decimals, m.priceUsd);
  }
  return usd;
};

/**
 * Cumulative invoices-paid count at `cutoff`: for each token, take the latest
 * bucket with timestamp <= cutoff (the @aggregate cumulative count is per-token
 * per-day) and sum the values across tokens.
 */
const invoicesPaidAt = (buckets: VolumeBucket[], cutoff: number): number => {
  const latestByToken = new Map<string, { ts: number; value: bigint }>();
  for (const b of buckets) {
    const ts = tsToSeconds(b.timestamp);
    if (ts > cutoff) continue;
    const id = b.token.id.toLowerCase();
    const existing = latestByToken.get(id);
    if (!existing || ts > existing.ts) {
      latestByToken.set(id, { ts, value: BigInt(b.invoicePaid) });
    }
  }
  let total = BigInt(0);
  for (const { value } of latestByToken.values()) total += value;
  return Number(total);
};

/**
 * Daily USD volume series (oldest → newest). Collapses the per-token daily
 * buckets into one USD total per day so the volume chart can plot a single
 * area. Day buckets are keyed by their (day-aligned) timestamp in seconds.
 */
const buildVolumeSeries = (
  buckets: VolumeBucket[],
  meta: Map<string, TokenMeta>,
): VolumeSeriesPoint[] => {
  const byDay = new Map<number, number>();
  for (const b of buckets) {
    const m = meta.get(b.token.id.toLowerCase());
    if (!m) continue;
    const ts = tsToSeconds(b.timestamp);
    const usd = toUsd(BigInt(b.dailyVolume), m.decimals, m.priceUsd);
    byDay.set(ts, (byDay.get(ts) ?? 0) + usd);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, volumeUsd]) => ({ timestamp, volumeUsd }));
};

/**
 * Daily running escrow balance (oldest → newest). Each day's `total` is the net
 * signed change for that token that day; the running per-token sum, converted to
 * USD at the current price, is the live balance plotted on the escrow chart.
 * Only days with escrow movement produce a point — the line steps between them.
 */
const buildEscrowSeries = (
  buckets: EscrowBucket[],
  meta: Map<string, TokenMeta>,
): EscrowSeriesPoint[] => {
  // ts -> tokenId -> net signed delta that day.
  const days = new Map<number, Map<string, bigint>>();
  for (const b of buckets) {
    const id = b.token.id.toLowerCase();
    if (!meta.has(id)) continue;
    const ts = tsToSeconds(b.timestamp);
    const dayMap = days.get(ts) ?? new Map<string, bigint>();
    dayMap.set(id, (dayMap.get(id) ?? BigInt(0)) + BigInt(b.total));
    days.set(ts, dayMap);
  }

  const runningByToken = new Map<string, bigint>();
  return [...days.keys()]
    .sort((a, b) => a - b)
    .map((ts) => {
      for (const [id, delta] of days.get(ts)!) {
        runningByToken.set(id, (runningByToken.get(id) ?? BigInt(0)) + delta);
      }
      let balanceUsd = 0;
      for (const [id, sum] of runningByToken) {
        const m = meta.get(id);
        if (!m) continue;
        balanceUsd += toUsd(sum, m.decimals, m.priceUsd);
      }
      return { timestamp: ts, balanceUsd };
    });
};

/**
 * Daily invoice-paid activity split by processor (oldest → newest). The
 * subgraph reports `totalActivity` as a cumulative count per processor, so the
 * per-day count is the diff between consecutive daily buckets for that type
 * (the earliest fetched bucket carries the full cumulative — it falls outside
 * the chart's visible window).
 */
const buildInvoiceActivitySeries = (
  buckets: InvoiceActivityBucket[],
): InvoiceActivityPoint[] => {
  const byType: Record<InvoiceType, { ts: number; cumulative: number }[]> = {
    SIMPLE: [],
    ADVANCED: [],
  };
  for (const b of buckets) {
    if (b.invoiceType !== "SIMPLE" && b.invoiceType !== "ADVANCED") continue;
    byType[b.invoiceType].push({
      ts: tsToSeconds(b.timestamp),
      cumulative: Number(b.totalActivity),
    });
  }

  const perDay = new Map<number, { website: number; marketplace: number }>();
  const accumulate = (type: InvoiceType, key: "website" | "marketplace") => {
    const series = byType[type].sort((a, b) => a.ts - b.ts);
    let prior = 0;
    for (let i = 0; i < series.length; i++) {
      const { ts, cumulative } = series[i];
      const delta = i === 0 ? cumulative : cumulative - prior;
      prior = cumulative;
      const entry = perDay.get(ts) ?? { website: 0, marketplace: 0 };
      entry[key] += delta;
      perDay.set(ts, entry);
    }
  };
  accumulate("SIMPLE", "website");
  accumulate("ADVANCED", "marketplace");

  return [...perDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, counts]) => ({ timestamp, ...counts }));
};

/**
 * Build the first-section metric snapshot from the subgraph. Runs a single
 * batched query for all four metrics and converts per-token amounts to USD
 * against the cached price map.
 */
export const fetchMetricsSnapshot = async (
  chainId: number,
): Promise<MetricsSnapshot> => {
  const bounds = getWindowBounds();
  const meta = tokenMetaByChain(chainId);

  // graph-node's Timestamp scalar is microseconds since epoch; pass as strings
  // because the microsecond value exceeds JS's safe-integer range.
  const toTimestamp = (seconds: number): string =>
    (BigInt(seconds) * BigInt(MICROS_PER_SECOND)).toString();

  const result = await client(chainId)
    .query<MetricsSnapshotData>(METRICS_SNAPSHOT_QUERY, {
      now: toTimestamp(bounds.now),
      sixtyDaysAgo: toTimestamp(bounds.sixtyDaysAgo),
    })
    .toPromise();

  if (result.error) throw new Error(result.error.message);
  const data = result.data;
  if (!data) throw new Error("Metrics snapshot returned no data");

  const volumeCurrent = sumWindowUsd(
    data.volumeBuckets,
    bounds.thirtyDaysAgo,
    bounds.now,
    (b) => b.dailyVolume,
    meta,
  );
  const volumePrior = sumWindowUsd(
    data.volumeBuckets,
    bounds.sixtyDaysAgo,
    bounds.thirtyDaysAgo,
    (b) => b.dailyVolume,
    meta,
  );
  const totalVolume: MetricValue = {
    value: volumeCurrent,
    changePct: percentChange(volumeCurrent, volumePrior),
  };

  const feesCurrent = sumWindowUsd(
    data.feeBuckets,
    bounds.thirtyDaysAgo,
    bounds.now,
    (b) => b.totalFeePaid,
    meta,
  );
  const feesPrior = sumWindowUsd(
    data.feeBuckets,
    bounds.sixtyDaysAgo,
    bounds.thirtyDaysAgo,
    (b) => b.totalFeePaid,
    meta,
  );
  const feesPaid: MetricValue = {
    value: feesCurrent,
    changePct: percentChange(feesCurrent, feesPrior),
  };

  const escrowNow = escrowAtUsd(data.escrowBuckets, bounds.now, meta);
  const escrowYesterday = escrowAtUsd(
    data.escrowBuckets,
    bounds.yesterdayMark,
    meta,
  );
  const escrowBalance: MetricValue = {
    value: escrowNow,
    changePct: percentChange(escrowNow, escrowYesterday),
  };

  const invNow = invoicesPaidAt(data.volumeBuckets, bounds.now);
  const invSeven = invoicesPaidAt(data.volumeBuckets, bounds.sevenDaysAgo);
  const invFourteen = invoicesPaidAt(
    data.volumeBuckets,
    bounds.fourteenDaysAgo,
  );
  const invoicesPaid: MetricValue = {
    value: invNow - invSeven,
    changePct: percentChange(invNow - invSeven, invSeven - invFourteen),
  };

  return {
    totalVolume,
    escrowBalance,
    feesPaid,
    invoicesPaid,
    volumeSeries: buildVolumeSeries(data.volumeBuckets, meta),
    escrowSeries: buildEscrowSeries(data.escrowBuckets, meta),
    invoiceActivitySeries: buildInvoiceActivitySeries(
      data.invoiceActivityBuckets,
    ),
    fetchedAt: bounds.now,
  };
};
