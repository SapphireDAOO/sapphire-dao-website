// Queries for the admin dashboard (all invoices, admin actions)

export const GET_ALL_INVOICES = `
  query GetAllInvoices(
    $skipInvoices: Int! = 0
    $firstInvoices: Int! = 50
    $includeInvoices: Boolean! = true
    $skipActions: Int! = 0
    $firstActions: Int! = 50
    $includeActions: Boolean! = true
    $skipSmartInvoices: Int! = 0
    $firstSmartInvoices: Int! = 50
    $includeSmartInvoices: Boolean! = true
  ) {
    invoices: simplePaymentProcessors(
      first: $firstInvoices
      skip: $skipInvoices
      orderBy: createdAt
      orderDirection: desc
    ) @include(if: $includeInvoices) {
      contract
      createdAt
      fee
      id
      invoiceId: invoiceNonce
      paidAt
      paymentTxHash
      price
      releaseHash
      releasedAt
      state
      amountPaid
      creationTxHash
      commisionTxHash: commissionTxHash
      refundTxHash
      seller { id }
      buyer { id }
    }
    adminActions(
      first: $firstActions
      skip: $skipActions
      orderBy: time
      orderDirection: desc
    ) @include(if: $includeActions) {
      id
      invoiceId: invoiceNonce
      time
      type: category
      action
      balance
      txHash
      currency { id }
    }
    smartInvoices: advancedPaymentProcessors(
      first: $firstSmartInvoices
      skip: $skipSmartInvoices
      orderBy: createdAt
      orderDirection: desc
    ) @include(if: $includeSmartInvoices) {
      contract
      createdAt
      id
      invoiceId: invoiceNonce
      paidAt
      price
      releasedAt
      state
      fee
      paymentTxHash
      amountPaid
      creationTxHash
      commisionTxHash: commissionTxHash
      refundTxHash
      seller { id }
      buyer { id }
    }
  }
`;
