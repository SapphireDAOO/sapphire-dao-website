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
    invoices(
      first: $firstInvoices
      skip: $skipInvoices
    ) {
      contract
      createdAt
      fee
      id
      invoiceId
      paidAt
      paymentTxHash
      price
      releaseHash
      releasedAt
      state
      amountPaid
      creationTxHash
      commisionTxHash
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
      invoiceId
      time
      type
      action
      balance
      txHash
    }
    smartInvoices(
      first: $firstSmartInvoices
      skip: $skipSmartInvoices
    ) {
      contract
      createdAt
      id
      invoiceId
      paidAt
      price
      releasedAt
      state
      fee
      paymentTxHash
      amountPaid
      creationTxHash
      commisionTxHash
      seller { id }
      buyer { id }
    }
  }
`;
