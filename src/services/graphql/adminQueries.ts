// Queries for the admin dashboard (all invoices, admin actions)

export const GET_ALL_INVOICES = `
  query GetAllInvoices(
    $skipInvoices: Int! = 0
    $firstInvoices: Int! = 50
    $skipActions: Int! = 0
    $firstActions: Int! = 50
    $skipSmartInvoices: Int! = 0
    $firstSmartInvoices: Int! = 50
  ) {
    invoices: simplePaymentProcessors(
      first: $firstInvoices
      skip: $skipInvoices
    ) {
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
    ) {
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
    ) {
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
