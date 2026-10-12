// graph-node names the collection `<entity>_collection`
// when the entity name already ends in "s".

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
    # ADVANCED = intermediated). totalActivity is a cumulative count, so per-day
    # activity is the diff between consecutive daily buckets — fetched from
    # genesis (no lower bound) so the earliest bucket's cumulative is that
    # day's true count and the diff baseline is never truncated. Buckets only
    # exist on days with activity, so this stays small.
    invoiceActivityBuckets: invoiceActivityStats_collection(
      interval: "day"
      where: { timestamp_lte: $now }
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

// totalFeePaid is a per-day sum, so the lifetime total sums every bucket.
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

export const STORAGE_CONFIG_QUERY = `
  query StorageConfig {
    storageConfiguration(id: "global") {
      feeReceiver
      updatedAt
    }
  }
`;

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
      target
      data
      proposedAt
      executedAt
    }
  }
`;
