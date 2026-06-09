// Subgraph queries for the metrics dashboard.
//
// Reads from the subgraph's native Timeseries & Aggregations — daily buckets
// pre-aggregated by graph-node — so windowed totals and % change views need no
// block-by-timestamp lookups or time-travel queries. graph-node renames the
// collection query to `<entityName>_collection` when the entity name already
// ends in "s" (here: VolumeStats → volumeStats_collection,
// FeePaidStats → feePaidStats_collection,
// InvoiceActivityStats → invoiceActivityStats_collection,
// NewUserStats → newUserStats_collection,
// ActiveUserStats → activeUserStats_collection), otherwise the simple plural
// (EscrowStat → escrowStats) works directly.
//
// One batched document covers the dashboard charts and first-section metrics:
// 60 days of volume + fee + invoice-activity + user buckets and the full escrow
// series share a single round-trip.

export const METRICS_SNAPSHOT_QUERY = `
  query MetricsSnapshot($now: Timestamp!, $sixtyDaysAgo: Timestamp!) {
    # Volume & cumulative invoicePaid — daily buckets per token over 60 days.
    # Drives Total Volume (30d vs prior 30d) and Invoices Paid (7d vs prior 7d).
    volumeBuckets: volumeStats_collection(
      interval: "day"
      where: { timestamp_gte: $sixtyDaysAgo, timestamp_lte: $now }
      first: 1000
    ) {
      timestamp
      token { id }
      dailyVolume
      invoicePaid
    }
    # Protocol fees — daily buckets per token over 60 days.
    feeBuckets: feePaidStats_collection(
      interval: "day"
      where: { timestamp_gte: $sixtyDaysAgo, timestamp_lte: $now }
      first: 1000
    ) {
      timestamp
      token { id }
      totalFeePaid
    }
    # Escrow — daily buckets per token across the full history.
    # totalBalance is the signed-delta sum (running sum = live balance, shown as
    # the card value); totalAmountPaid is the gross-paid sum (drives the chart
    # and the card's day-over-day % change).
    escrowBuckets: escrowStats(
      interval: "day"
      where: { timestamp_lte: $now }
      first: 1000
    ) {
      timestamp
      token { id }
      totalBalance
      totalAmountPaid
    }
    # Invoices paid per day, split by processor (SIMPLE = website,
    # ADVANCED = marketplace). totalActivity is a cumulative count, so per-day
    # activity is the diff between consecutive daily buckets.
    invoiceActivityBuckets: invoiceActivityStats_collection(
      interval: "day"
      where: { timestamp_gte: $sixtyDaysAgo, timestamp_lte: $now }
      first: 1000
    ) {
      timestamp
      invoiceType
      totalActivity
    }
    # New users per day by role (CREATOR = seller, PAYER = buyer). newUsers is a
    # per-day count (summed over a window); totalUsers is the cumulative total.
    newUserBuckets: newUserStats_collection(
      interval: "day"
      where: { timestamp_gte: $sixtyDaysAgo, timestamp_lte: $now }
      first: 1000
    ) {
      timestamp
      role
      newUsers
      totalUsers
    }
    # Unique users active per day; day-over-day growth comes from the last two
    # populated buckets.
    activeUserBuckets: activeUserStats_collection(
      interval: "day"
      where: { timestamp_gte: $sixtyDaysAgo, timestamp_lte: $now }
      first: 1000
    ) {
      timestamp
      activeUsers
    }
  }
`;

// Wallet Balance — Fee Receiver. All-time protocol fees collected per token
// (FeePaidStats.totalFeePaid is a per-day sum, so the lifetime total is the sum
// across every daily bucket). Converted to USD on the read path, this is the
// fees the receiver has accrued. No time bound — closed buckets are immutable.
export const FEE_RECEIVER_TOTALS_QUERY = `
  query FeeReceiverTotals {
    feeBuckets: feePaidStats_collection(
      interval: "day"
      first: 1000
    ) {
      token { id }
      totalFeePaid
    }
  }
`;

export const RECENT_TRANSACTIONS_QUERY = `
  query RecentTransactions($first: Int = 5) {
    invoiceEvents(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: {
        eventType_in: [
          INVOICE_PAID
          INVOICE_REFUNDED
          REFUNDED
          INVOICE_RELEASED
          PAYMENT_RELEASED
          DISPUTE_SETTLED
        ]
      }
    ) {
      id
      eventType
      txHash
      timestamp
      simpleInvoice {
        invoiceNonce
        price
        amountPaid
        buyer { id }
        seller { id }
      }
      advancedInvoice {
        invoiceNonce
        price
        amountPaid
        paymentToken { id name decimal }
        buyer { id }
        seller { id }
      }
    }
  }
`;

export const GAS_TRACKER_QUERY = `
  query GasTracker {
    gasPaid(id: "global") {
      amount
      transactionCount
      lastTimeStamp
    }
  }
`;
