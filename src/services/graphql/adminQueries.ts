// Queries for the admin dashboard (all invoices, admin actions)

// Walked with an id cursor: pass the last id of the previous page ("" for the
// first) until a page comes back short. Ordering by id is what makes the
// cursor sound; the admin table sorts rows itself.
export const GET_ALL_INVOICES = `
  query GetAllInvoices(
    $first: Int! = 1000
    $lastInvoiceId: ID! = ""
    $includeInvoices: Boolean! = true
    $lastSmartInvoiceId: ID! = ""
    $includeSmartInvoices: Boolean! = true
  ) {
    invoices: simplePaymentProcessors(
      first: $first
      where: { id_gt: $lastInvoiceId }
      orderBy: id
      orderDirection: asc
    ) @include(if: $includeInvoices) {
      contract
      fee
      id
      invoiceId: invoiceNonce
      price
      state
      releaseAt
      amountPaid
      expiresAt
      lastActionTime
      seller { id }
      buyer { id }
      events { eventType txHash timestamp }
    }
    # adminActions disabled: the AdminAction entity was dropped in the subgraph's
    # event-log migration. TODO: rebuild the admin actions feed from InvoiceEvent.
    smartInvoices: advancedPaymentProcessors(
      first: $first
      where: { id_gt: $lastSmartInvoiceId }
      orderBy: id
      orderDirection: asc
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
