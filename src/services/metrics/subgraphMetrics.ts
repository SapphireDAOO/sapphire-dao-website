import { ONE_DAY_MS, KNOWN_PAYMENT_TOKENS, ZERO_ADDRESS } from "@/constants";
import { fetchUsdPrices } from "@/services/exchangeRate";
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

const livePricesByChain = new Map<number, Record<string, number>>();

const PRICE_REFRESH_TTL_MS = 60_000;
const priceRefreshByChain = new Map<
  number,
  { startedAt: number; request: Promise<void> }
>();

/**
 * A failed lookup keeps the previous prices;
 * one that never succeeded leaves them at zero.
 */
export const refreshTokenPrices = async (
  chainId: number,
  signal?: AbortSignal,
): Promise<void> => {
  // A caller with its own abort signal gets its own
  // request, so aborting can't cancel anyone else's.
  if (signal) {
    await lookUpTokenPrices(chainId, signal);
    return;
  }

  const recent = priceRefreshByChain.get(chainId);
  if (recent && Date.now() - recent.startedAt < PRICE_REFRESH_TTL_MS) {
    return recent.request;
  }

  const request = lookUpTokenPrices(chainId).then((ok) => {
    if (!ok && priceRefreshByChain.get(chainId)?.request === request) {
      priceRefreshByChain.delete(chainId);
    }
  });
  priceRefreshByChain.set(chainId, { startedAt: Date.now(), request });
  return request;
};

const lookUpTokenPrices = async (
  chainId: number,
  signal?: AbortSignal,
): Promise<boolean> => {
  const symbols = (KNOWN_PAYMENT_TOKENS[chainId] ?? []).map((t) => t.name);
  const prices = await fetchUsdPrices(symbols, signal);
  if (Object.keys(prices).length === 0) return false;

  livePricesByChain.set(chainId, {
    ...(livePricesByChain.get(chainId) ?? {}),
    ...prices,
  });
  return true;
};

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

const tokenMetaByChain = (chainId: number): Map<string, TokenMeta> => {
  const out = new Map<string, TokenMeta>();
  for (const token of KNOWN_PAYMENT_TOKENS[chainId] ?? []) {
    out.set(token.id.toLowerCase(), {
      decimals: token.decimals,
      priceUsd: livePricesByChain.get(chainId)?.[token.name] ?? 0,
    });
  }
  return out;
};

export const fetchTokenPricesUsd = async (
  chainId: number,
): Promise<Record<string, number>> => {
  await refreshTokenPrices(chainId);
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
  totalBalance: string;
  totalAmountPaid: string;
}

type InvoiceType = "SIMPLE" | "ADVANCED";

interface InvoiceActivityBucket {
  timestamp: string;
  invoiceType: InvoiceType;
  totalActivity: string;
}

type UserRole = "CREATOR" | "PAYER";

interface NewUserBucket {
  timestamp: string;
  role: UserRole;
  newUsers: string;
  totalUsers: string;
}

interface ActiveUserBucket {
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

export const createUsdConverter = (
  chainId: number,
): ((tokenId: string, raw: bigint) => number) => {
  const meta = tokenMetaByChain(chainId);
  return (tokenId, raw) => {
    const m = meta.get(tokenId.toLowerCase());
    return m ? toUsd(raw, m.decimals, m.priceUsd) : 0;
  };
};

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
 * The @aggregate count is cumulative per token, so
 * take each token's latest bucket <= cutoff and sum.
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

// The running sum of signed totalBalance, the figure
// the card shows; totalAmountPaid only ever climbs.
const buildEscrowSeries = (
  buckets: EscrowBucket[],
  meta: Map<string, TokenMeta>,
): EscrowSeriesPoint[] => {
  const deltasByDay = new Map<number, Map<string, bigint>>();
  for (const b of buckets) {
    const ts = tsToSeconds(b.timestamp);
    const id = b.token.id.toLowerCase();
    const day = deltasByDay.get(ts) ?? new Map<string, bigint>();
    day.set(id, (day.get(id) ?? BigInt(0)) + BigInt(b.totalBalance));
    deltasByDay.set(ts, day);
  }

  const running = new Map<string, bigint>();
  return [...deltasByDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, deltas]) => {
      for (const [id, delta] of deltas) {
        running.set(id, (running.get(id) ?? BigInt(0)) + delta);
      }

      let balanceUsd = 0;
      for (const [id, sum] of running) {
        const m = meta.get(id);
        if (m) balanceUsd += toUsd(sum, m.decimals, m.priceUsd);
      }
      return { timestamp, balanceUsd };
    });
};

const INVOICE_ACTIVITY_WINDOW_DAYS = 7;

/**
 * totalActivity is cumulative, so a day's count is the
 * diff between buckets; earlier buckets seed the baseline.
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
    // An empty current bucket has a null timestamp; 0
    // would sort first and poison the diff baseline.
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

const latestTotalUsers = (buckets: NewUserBucket[], role: UserRole): number => {
  let best: { ts: number; value: number } | undefined;
  for (const b of buckets) {
    if (b.role !== role) continue;
    const ts = tsToSeconds(b.timestamp);
    if (!best || ts > best.ts) best = { ts, value: Number(b.totalUsers) };
  }
  return best?.value ?? 0;
};

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

/** Retries with `current: ignore` when the empty current bucket errors. */
const queryMetrics = async <T>(
  chainId: number,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const result = await client(chainId)
    .query<T>(query, variables)
    .toPromise();

  if (result.error) throwSubgraphError(result.error);
  if (!result.data) throw new Error("Metrics query returned no data");
  return result.data;
};

export const fetchMetricsSnapshot = async (
  chainId: number,
): Promise<MetricsSnapshot> => {
  const bounds = getWindowBounds();
  await refreshTokenPrices(chainId);
  const meta = tokenMetaByChain(chainId);

  // Microseconds exceed the safe-integer range, so they're passed as strings.
  const toTimestamp = (seconds: number): string =>
    (BigInt(seconds) * BigInt(MICROS_PER_SECOND)).toString();

  const data = await queryMetrics<MetricsSnapshotData>(
    chainId,
    METRICS_SNAPSHOT_QUERY,
    {
      // End of the current day: the same data,
      // but a cache key that holds all day.
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

  const escrowNow = escrowAtUsd(
    data.escrowBuckets,
    bounds.now,
    meta,
    (b) => b.totalBalance,
  );
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

export const fetchFeeReceiverTotalUsd = async (
  chainId: number,
): Promise<number> => {
  await refreshTokenPrices(chainId);
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

export const fetchNativePriceUsd = async (chainId: number): Promise<number> => {
  await refreshTokenPrices(chainId);
  const meta = tokenMetaByChain(chainId);
  return meta.get(ZERO_ADDRESS.toLowerCase())?.priceUsd ?? 0;
};

export const fetchFeeReceiverChangedAt = async (
  chainId: number,
): Promise<number | null> => {
  const result = await client(chainId)
    .query<{ storageConfiguration: { updatedAt: string | null } | null }>(
      STORAGE_CONFIG_QUERY,
      {},
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);

  const updatedAt = result.data?.storageConfiguration?.updatedAt;
  
  return updatedAt != null ? Number(updatedAt) : null;
};
