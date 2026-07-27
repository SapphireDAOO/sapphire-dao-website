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
  query MetricsSnapshot(
    $now: Timestamp!
    $sixtyDaysAgo: Timestamp!
    $dayMark: Timestamp!
    $yesterdayMark: Timestamp!
  ) {
    # Volume & cumulative invoicePaid — daily buckets per token over 60 days.
    # Drives Total Volume (30d vs prior 30d) and Invoices Paid (7d vs prior 7d).
    volumeBuckets: volumeStats_collection(
      interval: "day"
      where: { timestamp_gte: $sixtyDaysAgo, timestamp_lte: $now }
      first: 1000
      current: include
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
      current: include
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
      current: include
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
      current: include
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
      current: include
    ) {
      timestamp
      role
      newUsers
      totalUsers
    }
    # Active users (24h): only today and yesterday — no 60-day fetch. Each day is
    # pinned by its own where-filter, so we don't select the timestamp field (and
    # thus avoid the empty-current-bucket null) and don't depend on bucket order.
    activeTodayBuckets: activeUserStats_collection(
      interval: "day"
      where: { timestamp_gte: $dayMark }
      first: 1000
      current: include
    ) {
      activeUsers
    }
    activeYesterdayBuckets: activeUserStats_collection(
      interval: "day"
      where: { timestamp_gte: $yesterdayMark, timestamp_lt: $dayMark }
      first: 1000
    ) {
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
      current: include
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

// Paginated INVOICE_PAID events since a unix-seconds cutoff (e.g. last 30 days),
// newest first. `first`/`skip` page through the list; the amount is read from the
// linked invoice, same as the Recent Transactions feed.
export const PAID_TRANSACTIONS_QUERY = `
  query PaidTransactions($since: BigInt!, $first: Int!, $skip: Int!) {
    invoiceEvents(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
      where: { eventType: INVOICE_PAID, timestamp_gte: $since }
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

// Paginated escrow-moving events since a unix-seconds cutoff, newest first.
// INVOICE_PAID is an inflow; releases / refunds / dispute settlements are
// outflows (both simple and intermediated processor variants).
export const ESCROW_TRANSACTIONS_QUERY = `
  query EscrowTransactions($since: BigInt!, $first: Int!, $skip: Int!) {
    invoiceEvents(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
      where: {
        eventType_in: [
          INVOICE_PAID
          INVOICE_RELEASED
          PAYMENT_RELEASED
          INVOICE_REFUNDED
          REFUNDED
          DISPUTE_SETTLED
        ]
        timestamp_gte: $since
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

// Paginated fee payments from the FeePaid timeseries since a microsecond cutoff,
// newest first. FeePaid only carries timestamp + token + amount.
export const FEES_PAID_QUERY = `
  query FeesPaid($since: Timestamp!, $first: Int!, $skip: Int!) {
    feePaids(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
      where: { timestamp_gte: $since }
    ) {
      id
      timestamp
      token { id }
      amount
      txHash
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

// Storage configuration singleton (id: "global"). updatedAt is the unix-seconds
// timestamp of the last config-changing storage event — used to show how long
// ago the fee receiver was changed.
export const STORAGE_CONFIG_QUERY = `
  query StorageConfig {
    storageConfiguration(id: "global") {
      feeReceiver
      updatedAt
    }
  }
`;

// Most recent multisig transactions (admin actions), newest first. id is the
// txHash, used for the block-explorer link.
export const ADMIN_TRANSACTIONS_QUERY = `
  query AdminTransactions($first: Int = 5) {
    multiSigTransactions(
      first: $first
      orderBy: proposedAt
      orderDirection: desc
    ) {
      id
      status
      proposer
      executor
      approvalCount
      nonce
      proposedAt
      executedAt
    }
  }
`;
