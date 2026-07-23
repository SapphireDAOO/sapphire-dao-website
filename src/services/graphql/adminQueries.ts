// Queries for the admin dashboard (all invoices, admin actions)

export const GET_ALL_INVOICES = `
  query GetAllInvoices(
    $skipInvoices: Int! = 0
    $firstInvoices: Int! = 50
    $includeInvoices: Boolean! = true
    $skipSmartInvoices: Int! = 0
    $firstSmartInvoices: Int! = 50
    $includeSmartInvoices: Boolean! = true
  ) {
    invoices: simplePaymentProcessors(
      first: $firstInvoices
      skip: $skipInvoices
      orderBy: lastActionTime
      orderDirection: desc
    ) @include(if: $includeInvoices) {
      contract
      fee
      id
      invoiceId: invoiceNonce
      price
      state
      releaseAt
      amountPaid
      invalidateAt
      lastActionTime
      seller { id }
      buyer { id }
      events { eventType txHash timestamp }
    }
    # adminActions disabled: the AdminAction entity was dropped in the subgraph's
    # event-log migration. TODO: rebuild the admin actions feed from InvoiceEvent.
    smartInvoices: advancedPaymentProcessors(
      first: $firstSmartInvoices
      skip: $skipSmartInvoices
      orderBy: lastActionTime
      orderDirection: desc
    ) @include(if: $includeSmartInvoices) {
      contract
      id
      invoiceId: invoiceNonce
      price
      state
      releaseAt
      fee
      amountPaid
      lastActionTime
      seller { id }
      buyer { id }
      events { eventType txHash timestamp }
    }
  }
`;
