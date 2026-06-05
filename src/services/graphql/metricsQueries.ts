// Subgraph queries for the dashboard metric page (first section).
//
// These read from the subgraph's native Timeseries & Aggregations — daily
// (and, for escrow, hourly) buckets rolled up automatically by graph-node — so
// windowed and percentage-change views need no block-by-timestamp lookups or
// time-travel queries. Window totals are summed on the client from the daily
// buckets; closed daily buckets are immutable and safely cacheable.
//

// Token metadata (decimals/name) for normalizing raw BigInt amounts before the
// read-time USD conversion. Native ETH uses the zero-address PaymentToken id.
export const PAYMENT_TOKENS_QUERY = `
  query MetricsPaymentTokens {
    paymentTokens(first: 100) {
      id
      name
      decimal
    }
  }
`;

// Total Volume — daily VolumeStats buckets within a window, per token.
// Run once per window ([sixtyDaysAgo, thirtyDaysAgo] for W_prior and
// [thirtyDaysAgo, now] for W_curr); Σ dailyVolume per token, then convert to
// USD and sum across tokens on the client.
export const VOLUME_WINDOW_QUERY = `
  query VolumeWindow($start: Timestamp!, $end: Timestamp!) {
    volumeStats(
      interval: day
      where: { timestamp_gte: $start, timestamp_lte: $end }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
    ) {
      timestamp
      token {
        id
        decimal
      }
      dailyVolume
    }
  }
`;

// Total Invoices Paid — cumulative count surfaced over a 7-day window.
// VolumeStats.invoicePaid is cumulative; the window count is the latest
// cumulative value minus the cumulative value at the window's start edge.
export const INVOICES_PAID_WINDOW_QUERY = `
  query InvoicesPaidWindow($start: Timestamp!, $end: Timestamp!) {
    volumeStats(
      interval: day
      where: { timestamp_gte: $start, timestamp_lte: $end }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
    ) {
      timestamp
      invoicePaid
    }
  }
`;

// Total Escrow Balance — live balance is the running sum of signed EscrowStat
// buckets per token. Pull the daily buckets across the window so the client can
// derive the live total and the day-over-day change.
export const ESCROW_WINDOW_QUERY = `
  query EscrowWindow($start: Timestamp!, $end: Timestamp!) {
    escrowStats(
      interval: day
      where: { timestamp_gte: $start, timestamp_lte: $end }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
    ) {
      timestamp
      token {
        id
        decimal
      }
      total
    }
  }
`;

// Total Fees Paid — daily FeePaidStats buckets within a window, per token.
// Same windowed pattern as Total Volume: Σ totalFeePaid per token per window,
// converted to USD and summed on the client.
export const FEES_WINDOW_QUERY = `
  query FeesWindow($start: Timestamp!, $end: Timestamp!) {
    feePaidStats(
      interval: day
      where: { timestamp_gte: $start, timestamp_lte: $end }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
    ) {
      timestamp
      token {
        id
        decimal
      }
      totalFeePaid
    }
  }
`;
