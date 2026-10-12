export interface GasStats {
  /** Cumulative gas paid by platform wallets, in wei. */
  totalGasWei: bigint;
  transactionCount: number;
  /** Unix seconds of the most recent recorded gas payment. */
  lastTimestamp: number;
}

export type TransactionKind = "paid" | "refunded" | "released" | "settled";

export interface RecentTransaction {
  id: string;
  kind: TransactionKind;
  source: "Simple" | "Intermediated";
  invoiceNonce: string;
  txHash: string;
  /** Unix seconds the event was recorded. */
  timestamp: number;
  amount: string;
  currency: string;
  amountUsd?: number;
  counterparty?: string;
}

export interface MetricValue {
  value: number;
  /** Percentage change vs. the prior window, or null when not computable. */
  changePct: number | null;
}

export interface VolumeSeriesPoint {
  /** Unix seconds at the start of the day bucket. */
  timestamp: number;
  volumeUsd: number;
}

export interface EscrowSeriesPoint {
  /** Unix seconds at the start of the day bucket. */
  timestamp: number;
  balanceUsd: number;
}

export interface InvoiceActivityPoint {
  /** Unix seconds at the start of the day bucket. */
  timestamp: number;
  website: number;
  intermediated: number;
}

export interface UserMetrics {
  newCreators: MetricValue;
  newPayers: MetricValue;
  activeUsers: MetricValue;
  totalUsers: number;
}

export interface MetricsSnapshot {
  totalVolume: MetricValue;
  escrowBalance: MetricValue;
  feesPaid: MetricValue;
  invoicesPaid: MetricValue;
  volumeSeries: VolumeSeriesPoint[];
  escrowSeries: EscrowSeriesPoint[];
  invoiceActivitySeries: InvoiceActivityPoint[];
  userMetrics: UserMetrics;
  /** Unix seconds the snapshot was produced; used to reseed websocket state. */
  fetchedAt: number;
}

export interface MetricsDelta {
  volumeUsd?: number;
  /** Signed USD escrow delta for the live balance (+ on payment, − on settlement). */
  escrowUsd?: number;
  /** USD gross-paid added by a payment (drives the escrow chart; payment only). */
  escrowPaidUsd?: number;
  feesUsd?: number;
  invoicesPaid?: number;
  activityWebsite?: number;
  activityIntermediated?: number;
}

export type MetricsSocketStatus = "connecting" | "open" | "closed" | "error";
