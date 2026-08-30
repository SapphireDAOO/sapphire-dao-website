// Subgraph side of the hybrid metric flow: fetch the source-of-truth snapshot
// for the first-section metrics. A single batched query pulls 60 days of daily
// buckets in one round-trip; all four metric values are derived on the client.
// Raw token amounts are converted to USD at read time against a globally-cached
// price (see fetchTokenPricesUsd).

import { ONE_DAY_MS, KNOWN_PAYMENT_TOKENS, ZERO_ADDRESS } from "@/constants";
import type {
  EscrowSeriesPoint,
  InvoiceActivityPoint,
  MetricsSnapshot,
  MetricValue,
  UserMetrics,
  VolumeSeriesPoint,
} from "./types";
import { client } from "../graphql/client";
import {
  METRICS_SNAPSHOT_QUERY,
  FEE_RECEIVER_TOTALS_QUERY,
  STORAGE_CONFIG_QUERY,
} from "../graphql/metricsQueries";
import { throwSubgraphError } from "./errors";

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

/**
 * % change vs. the prior window. When the prior window is 0 we can't divide, so
 * a move from nothing to a non-zero value reads as a full ±100% (and 0 → 0 stays
 * null, i.e. no change to show).
 */
export const percentChange = (current: number, prior: number): number | null => {
  if (prior === 0) {
    if (current === 0) return null;
    return current > 0 ? 100 : -100;
  }
  return ((current - prior) / prior) * 100;
};

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
  /** Σ signed balance deltas for the day (running sum = live escrow balance). */
  totalBalance: string;
  /** Σ gross amount paid into escrow for the day. */
  totalAmountPaid: string;
}

type InvoiceType = "SIMPLE" | "ADVANCED";

interface InvoiceActivityBucket {
  timestamp: string;
  invoiceType: InvoiceType;
  /** Cumulative paid-invoice count for this processor through this day. */
  totalActivity: string;
}

type UserRole = "CREATOR" | "PAYER";

interface NewUserBucket {
  timestamp: string;
  role: UserRole;
  /** Users added this day for the role. */
  newUsers: string;
  /** Cumulative users for the role through this day. */
  totalUsers: string;
}

interface ActiveUserBucket {
  /** Unique users active this day (the day is pinned by the query's filter). */
  activeUsers: string;
}

interface MetricsSnapshotData {
  volumeBuckets: VolumeBucket[];
  feeBuckets: FeeBucket[];
  escrowBuckets: EscrowBucket[];
  invoiceActivityBuckets: InvoiceActivityBucket[];
  newUserBuckets: NewUserBucket[];
  activeTodayBuckets: ActiveUserBucket[];
  activeYesterdayBuckets: ActiveUserBucket[];
}

const toUsd = (raw: bigint, decimals: number, priceUsd: number): number => {
  if (!priceUsd) return 0;
  return (Number(raw) / 10 ** decimals) * priceUsd;
};

/**
 * Build a reusable (tokenId, rawAmount) → USD converter for a chain, using the
 * same decimals + cached price map the snapshot uses. Returns 0 for unknown
 * tokens. Shared with the live socket so optimistic deltas convert identically.
 */
export const createUsdConverter = (
  chainId: number,
): ((tokenId: string, raw: bigint) => number) => {
  const meta = tokenMetaByChain(chainId);
  return (tokenId, raw) => {
    const m = meta.get(tokenId.toLowerCase());
    return m ? toUsd(raw, m.decimals, m.priceUsd) : 0;
  };
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
 * Running USD escrow figure at `cutoff`: per-token sum of the chosen field
 * across every bucket with timestamp <= cutoff, converted at the current price.
 * Used for both the live balance (totalBalance) and the gross-paid running total
 * (totalAmountPaid) behind the card's % change.
 */
const escrowAtUsd = (
  buckets: EscrowBucket[],
  cutoff: number,
  meta: Map<string, TokenMeta>,
  amount: (b: EscrowBucket) => string,
): number => {
  const perToken = new Map<string, bigint>();
  for (const b of buckets) {
    if (tsToSeconds(b.timestamp) > cutoff) continue;
    const id = b.token.id.toLowerCase();
    perToken.set(id, (perToken.get(id) ?? BigInt(0)) + BigInt(amount(b)));
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
 * Volume series (oldest → newest) from VolumeStats: each point is that day's own
 * volume (per-token `dailyVolume` summed into one USD total per day). Per-day,
 * standalone — not cumulative. Day buckets are keyed by their (day-aligned)
 * timestamp in seconds.
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
 * Escrow chart series (oldest → newest): the escrow volume paid in each day
 * (per-token `totalAmountPaid` summed into one USD total per day). Per-day,
 * standalone — not a running balance. Only days with escrow movement produce
 * a point.
 */
const buildEscrowSeries = (
  buckets: EscrowBucket[],
  meta: Map<string, TokenMeta>,
): EscrowSeriesPoint[] => {
  const byDay = new Map<number, number>();
  for (const b of buckets) {
    const m = meta.get(b.token.id.toLowerCase());
    if (!m) continue;
    const ts = tsToSeconds(b.timestamp);
    const usd = toUsd(BigInt(b.totalAmountPaid), m.decimals, m.priceUsd);
    byDay.set(ts, (byDay.get(ts) ?? 0) + usd);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, balanceUsd]) => ({ timestamp, balanceUsd }));
};

// The Invoice Activity card is fixed to a rolling 7-day view; the series is
// zero-filled so every calendar day in that window is present even when the
// subgraph has no bucket for it (buckets only exist on days with activity).
const INVOICE_ACTIVITY_WINDOW_DAYS = 7;

/**
 * Daily invoice-paid activity split by processor over the trailing 7 calendar
 * days (oldest → newest), zero-filled for days without activity. The subgraph
 * reports `totalActivity` as a cumulative count per processor, so the per-day
 * count is the diff between consecutive daily buckets for that type. Buckets
 * are fetched from genesis (not just the window) so the earliest bucket's
 * cumulative *is* that day's count; buckets before the window only seed the
 * diff baseline.
 */
const buildInvoiceActivitySeries = (
  buckets: InvoiceActivityBucket[],
  dayMark: number,
): InvoiceActivityPoint[] => {
  const windowStart =
    dayMark - (INVOICE_ACTIVITY_WINDOW_DAYS - 1) * SECONDS_PER_DAY;

  const perDay = new Map<number, InvoiceActivityPoint>();
  for (let ts = windowStart; ts <= dayMark; ts += SECONDS_PER_DAY) {
    perDay.set(ts, { timestamp: ts, website: 0, intermediated: 0 });
  }

  const byType: Record<InvoiceType, { ts: number; cumulative: number }[]> = {
    SIMPLE: [],
    ADVANCED: [],
  };
  for (const b of buckets) {
    if (b.invoiceType !== "SIMPLE" && b.invoiceType !== "ADVANCED") continue;
    // An empty current bucket comes back with a null timestamp (see the
    // activeUserStats comment in the query); ts=0 would sort first and poison
    // the cumulative-diff baseline.
    if (!b.timestamp) continue;
    byType[b.invoiceType].push({
      ts: tsToSeconds(b.timestamp),
      cumulative: Number(b.totalActivity),
    });
  }

  const accumulate = (type: InvoiceType, key: "website" | "intermediated") => {
    const series = byType[type].sort((a, b) => a.ts - b.ts);
    let prior = 0;
    for (const { ts, cumulative } of series) {
      const delta = cumulative - prior;
      prior = cumulative;
      const entry = perDay.get(ts);
      if (entry) entry[key] += delta;
    }
  };
  accumulate("SIMPLE", "website");
  accumulate("ADVANCED", "intermediated");

  return [...perDay.values()];
};

/** Σ per-day `newUsers` for a role within [start, end]. */
const sumNewUsers = (
  buckets: NewUserBucket[],
  role: UserRole,
  start: number,
  end: number,
): number => {
  let total = 0;
  for (const b of buckets) {
    if (b.role !== role) continue;
    const ts = tsToSeconds(b.timestamp);
    if (ts < start || ts > end) continue;
    total += Number(b.newUsers);
  }
  return total;
};

/** Cumulative user total for a role: the latest bucket's `totalUsers`. */
const latestTotalUsers = (buckets: NewUserBucket[], role: UserRole): number => {
  let best: { ts: number; value: number } | undefined;
  for (const b of buckets) {
    if (b.role !== role) continue;
    const ts = tsToSeconds(b.timestamp);
    if (!best || ts > best.ts) best = { ts, value: Number(b.totalUsers) };
  }
  return best?.value ?? 0;
};

/**
 * User metrics: 7-day new-creator / new-payer counts vs. the prior 7 days, the
 * latest day's active-user count with day-over-day growth, and the cumulative
 * user total.
 */
const buildUserMetrics = (
  newUserBuckets: NewUserBucket[],
  activeTodayBuckets: ActiveUserBucket[],
  activeYesterdayBuckets: ActiveUserBucket[],
  bounds: ReturnType<typeof getWindowBounds>,
): UserMetrics => {
  const windowed = (role: UserRole): MetricValue => {
    const current = sumNewUsers(
      newUserBuckets,
      role,
      bounds.sevenDaysAgo,
      bounds.now,
    );
    const prior = sumNewUsers(
      newUserBuckets,
      role,
      bounds.fourteenDaysAgo,
      bounds.sevenDaysAgo,
    );
    return { value: current, changePct: percentChange(current, prior) };
  };

  // Active users (24h): today's unique count vs. yesterday's. Each set is
  // already pinned to its day by the query filter, so just sum across tokens.
  const sumActive = (buckets: ActiveUserBucket[]): number =>
    buckets.reduce((total, b) => total + Number(b.activeUsers), 0);
  const activeLatest = sumActive(activeTodayBuckets);
  const activePrev = sumActive(activeYesterdayBuckets);

  return {
    newCreators: windowed("CREATOR"),
    newPayers: windowed("PAYER"),
    activeUsers: {
      value: activeLatest,
      changePct: percentChange(activeLatest, activePrev),
    },
    totalUsers:
      latestTotalUsers(newUserBuckets, "CREATOR") +
      latestTotalUsers(newUserBuckets, "PAYER"),
  };
};

/**
 * Run a metrics query, tolerating the empty-current-bucket error above. On that
 * error we retry with `current: include` swapped for `current: ignore`, so a
 * brand-new day with no activity simply contributes 0 instead of failing.
 */
const queryMetrics = async <T>(
  chainId: number,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  // network-only: these fetchers sit behind react-query, which is the caching
  // and freshness layer. Serving them cache-first would (a) make every
  // react-query refetch a stale no-op and (b) with time-derived variables,
  // pile a new entry into urql's never-evicted document cache per fetch —
  // network-only overwrites the same key instead.
  const result = await client(chainId)
    .query<T>(query, variables, { requestPolicy: "network-only" })
    .toPromise();

  if (result.error) throwSubgraphError(result.error);
  if (!result.data) throw new Error("Metrics query returned no data");
  return result.data;
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

  const data = await queryMetrics<MetricsSnapshotData>(
    chainId,
    METRICS_SNAPSHOT_QUERY,
    {
      // $now only upper-bounds day-aligned buckets, so end-of-current-day
      // returns identical data while keeping the variables (and therefore the
      // urql document-cache key) stable for the whole day instead of minting
      // a new cache entry every fetch.
      now: toTimestamp(bounds.dayMark + SECONDS_PER_DAY),
      sixtyDaysAgo: toTimestamp(bounds.sixtyDaysAgo),
      dayMark: toTimestamp(bounds.dayMark),
      yesterdayMark: toTimestamp(bounds.yesterdayMark),
    },
  );

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

  // Card value: live balance = running sum of signed deltas (totalBalance).
  const escrowNow = escrowAtUsd(
    data.escrowBuckets,
    bounds.now,
    meta,
    (b) => b.totalBalance,
  );
  // Card % change: escrow balance today vs. the balance as of yesterday.
  const escrowYesterday = escrowAtUsd(
    data.escrowBuckets,
    bounds.yesterdayMark,
    meta,
    (b) => b.totalBalance,
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
      bounds.dayMark,
    ),
    userMetrics: buildUserMetrics(
      data.newUserBuckets,
      data.activeTodayBuckets,
      data.activeYesterdayBuckets,
      bounds,
    ),
    fetchedAt: bounds.now,
  };
};

interface FeeTotalBucket {
  token: TokenRef;
  totalFeePaid: string;
}

/**
 * Wallet Balance — Fee Receiver. Lifetime protocol fees collected, summed across
 * every daily bucket per token and converted to USD against the cached price.
 */
export const fetchFeeReceiverTotalUsd = async (
  chainId: number,
): Promise<number> => {
  const meta = tokenMetaByChain(chainId);
  const data = await queryMetrics<{ feeBuckets: FeeTotalBucket[] }>(
    chainId,
    FEE_RECEIVER_TOTALS_QUERY,
    {},
  );

  let usd = 0;
  for (const b of data.feeBuckets ?? []) {
    const m = meta.get(b.token.id.toLowerCase());
    if (!m) continue;
    usd += toUsd(BigInt(b.totalFeePaid), m.decimals, m.priceUsd);
  }
  return usd;
};

/**
 * Current USD price of the chain's native token (ETH, the zero-address entry in
 * KNOWN_PAYMENT_TOKENS), used to value the gas-reserve balance. Async to match
 * the price-feed read path that will replace the testnet placeholder prices.
 */
export const fetchNativePriceUsd = async (chainId: number): Promise<number> => {
  const meta = tokenMetaByChain(chainId);
  return meta.get(ZERO_ADDRESS.toLowerCase())?.priceUsd ?? 0;
};

/**
 * Unix seconds of the last storage-config change (StorageConfiguration.updatedAt),
 * used to show how long ago the fee receiver was changed. Null when the config
 * singleton hasn't been indexed yet.
 */
export const fetchFeeReceiverChangedAt = async (
  chainId: number,
): Promise<number | null> => {
  const result = await client(chainId)
    .query<{ storageConfiguration: { updatedAt: string | null } | null }>(
      STORAGE_CONFIG_QUERY,
      {},
      { requestPolicy: "network-only" },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);

  const updatedAt = result.data?.storageConfiguration?.updatedAt;
  
  return updatedAt != null ? Number(updatedAt) : null;
};
