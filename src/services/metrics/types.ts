// Shared types for the dashboard metric page.
//
// The page is fed by a hybrid data flow:
//   - the subgraph provides the source-of-truth snapshot (cumulative values and
//     windowed/percentage-change figures rolled up from Timeseries & Aggregations);
//   - a websocket stream provides live deltas that are applied optimistically on
//     top of the last subgraph snapshot between polls.

/** Gas Tracker figures from the GasPaid singleton (cumulative platform-wallet
 *  gas spend). Current gas price is sourced live, not from this entity. */
export interface GasStats {
  /** Cumulative gas paid by platform wallets, in wei. */
  totalGasWei: bigint;
  /** Number of platform transactions counted. */
  transactionCount: number;
  /** Unix seconds of the most recent recorded gas payment. */
  lastTimestamp: number;
}

/** Settlement kinds surfaced in the Recent Transactions list, mapped from the
 *  subgraph's PaymentProcessorEventType. */
export type TransactionKind = "paid" | "refunded" | "released" | "settled";

/** One row in the Recent Transactions list: a settlement-type InvoiceEvent with
 *  its amount read from the linked invoice. */
export interface RecentTransaction {
  /** InvoiceEvent id (unique per event). */
  id: string;
  kind: TransactionKind;
  /** Which processor the invoice belongs to. */
  source: "Simple" | "Marketplace";
  /** Display invoice number (invoiceNonce). */
  invoiceNonce: string;
  /** Transaction hash, used to build the block-explorer link. */
  txHash: string;
  /** Unix seconds the event was recorded. */
  timestamp: number;
  /** Amount from the linked invoice, formatted in token units. */
  amount: string;
  /** Token symbol (e.g. "ETH", "mUSDC"). */
  currency: string;
  /** USD-converted value of the amount; undefined when not computed. */
  amountUsd?: number;
  /** Counterparty address (payer, falling back to seller). */
  counterparty?: string;
}

/** A single displayed metric: its current windowed value plus the % change
 *  versus the prior comparison window. `changePct` is null when the prior
 *  window had no activity (guard against divide-by-zero). */
export interface MetricValue {
  /** Displayed value. USD for volume/escrow/fees, raw count for invoices. */
  value: number;
  /** Percentage change vs. the prior window, or null when not computable. */
  changePct: number | null;
}

/** A single day in the volume time series, USD-converted across all tokens. */
export interface VolumeSeriesPoint {
  /** Unix seconds at the start of the day bucket. */
  timestamp: number;
  /** Total USD volume for that day across every supported token. */
  volumeUsd: number;
}

/** A single day in the escrow time series: running balance, USD-converted. */
export interface EscrowSeriesPoint {
  /** Unix seconds at the start of the day bucket. */
  timestamp: number;
  /** Running escrow balance as of end-of-day across every supported token. */
  balanceUsd: number;
}

/** One day of invoice-paid activity, split by payment processor. The simple
 *  processor backs the public website; the intermediated processor backs the
 *  marketplace. */
export interface InvoiceActivityPoint {
  /** Unix seconds at the start of the day bucket. */
  timestamp: number;
  /** Invoices paid that day via the simple processor (website). */
  website: number;
  /** Invoices paid that day via the intermediated processor (marketplace). */
  marketplace: number;
}

/**
 * User-activity metrics. New-user counts are 7-day windows vs. the prior 7 days
 * (raw counts, per the spec); active users is the latest day's unique count with
 * day-over-day growth. Totals are cumulative across creators (sellers) and
 * payers (buyers).
 */
export interface UserMetrics {
  /** New creators (sellers) added in the last 7 days vs. the prior 7 days. */
  newCreators: MetricValue;
  /** New payers (buyers) added in the last 7 days vs. the prior 7 days. */
  newPayers: MetricValue;
  /** Unique users active on the latest day, vs. the previous active day. */
  activeUsers: MetricValue;
  /** Cumulative all-time users (creators + payers). */
  totalUsers: number;
}

/**
 * First-section metrics, as described in rev/first-section-metrics.md.
 * All monetary values are already converted to USD at read time against the
 * cached token price (the frontend never re-derives USD from raw token amounts).
 */
export interface MetricsSnapshot {
  /** Total Volume — 30-day window vs. prior 30-day window. */
  totalVolume: MetricValue;
  /** Total Escrow Balance — live balance vs. yesterday. */
  escrowBalance: MetricValue;
  /** Total Fees Paid — 30-day window vs. prior 30-day window. */
  feesPaid: MetricValue;
  /** Total Invoices Paid — cumulative count surfaced over a 7-day window. */
  invoicesPaid: MetricValue;
  /** Daily USD volume series (oldest → newest) backing the volume chart. */
  volumeSeries: VolumeSeriesPoint[];
  /** Daily running escrow-balance series (oldest → newest). */
  escrowSeries: EscrowSeriesPoint[];
  /** Daily invoice-paid activity split by processor (oldest → newest). */
  invoiceActivitySeries: InvoiceActivityPoint[];
  /** New/active/total user counts. */
  userMetrics: UserMetrics;
  /** Unix seconds the snapshot was produced; used to reseed websocket state. */
  fetchedAt: number;
}

/**
 * A live delta pushed over the websocket. Each field is added on top of the
 * current optimistic value; absent fields are left untouched. Monetary fields
 * are pre-converted to USD by the producer using the same cached price the
 * snapshot used.
 */
export interface MetricsDelta {
  /** USD volume added by a new payment. */
  volumeUsd?: number;
  /** Signed USD escrow delta for the live balance (+ on payment, − on settlement). */
  escrowUsd?: number;
  /** USD gross-paid added by a payment (drives the escrow chart; payment only). */
  escrowPaidUsd?: number;
  /** USD fees realized (release / dispute settlement). */
  feesUsd?: number;
  /** Number of invoices paid (cumulative, never decremented). */
  invoicesPaid?: number;
  /** Invoice-activity bumps via the simple processor (website). */
  activityWebsite?: number;
  /** Invoice-activity bumps via the intermediated processor (marketplace). */
  activityMarketplace?: number;
}

export type MetricsSocketStatus = "connecting" | "open" | "closed" | "error";
