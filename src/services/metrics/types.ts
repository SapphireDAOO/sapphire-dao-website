// Shared types for the dashboard metric page.
//
// The page is fed by a hybrid data flow:
//   - the subgraph provides the source-of-truth snapshot (cumulative values and
//     windowed/percentage-change figures rolled up from Timeseries & Aggregations);
//   - a websocket stream provides live deltas that are applied optimistically on
//     top of the last subgraph snapshot between polls.

/** A single displayed metric: its current windowed value plus the % change
 *  versus the prior comparison window. `changePct` is null when the prior
 *  window had no activity (guard against divide-by-zero). */
export interface MetricValue {
  /** Displayed value. USD for volume/escrow/fees, raw count for invoices. */
  value: number;
  /** Percentage change vs. the prior window, or null when not computable. */
  changePct: number | null;
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
  /** Signed USD escrow delta (+ on payment, − on settlement). */
  escrowUsd?: number;
  /** USD fees realized. */
  feesUsd?: number;
  /** Number of invoices paid (cumulative, never decremented). */
  invoicesPaid?: number;
}

export type MetricsSocketStatus = "connecting" | "open" | "closed" | "error";
