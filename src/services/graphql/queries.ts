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
      orderBy: createdAt
      orderDirection: desc
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
      invalidateAt
      expiresAt
      state
      amountPaid
      creationTxHash
      commisionTxHash
      seller {
        id
      }
      buyer {
        id
      }
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
      orderBy: createdAt
      orderDirection: desc
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
      seller {
        id
      }
      buyer {
        id
      }
    }
}
`;

// GraphQL query to fetch invoices for a specific user
export const invoiceQuery = `query (
  $address: String!
  $firstOwned: Int! = 50
  $skipOwned: Int! = 0
  $firstPaid: Int! = 50
  $skipPaid: Int! = 0
  $firstIssued: Int! = 50
  $skipIssued: Int! = 0
  $firstReceived: Int! = 50
  $skipReceived: Int! = 0
) {
  user (id: $address) {
    ownedInvoices (
      first: $firstOwned
      skip: $skipOwned
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
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
      refundTxHash
      invalidateAt
      expiresAt
      state
      buyer {
        id
      }
      seller {
        id
      }
      history
      historyTime
    }
    paidInvoices (
      first: $firstPaid
      skip: $skipPaid
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      contract
      createdAt
      fee
      id
      invoiceId
      paidAt
      paymentTxHash
      price
      releaseHash
      refundTxHash
      releasedAt
      invalidateAt
      expiresAt
      state
      seller {
        id
      }
      buyer {
        id
      }
      history
      historyTime
    }
    issuedInvoices (
      first: $firstIssued
      skip: $skipIssued
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      contract
      createdAt
      id
      invoiceId
      paidAt
      price
      releasedAt
      state
      refundTxHash
      paymentToken {
        id
      }
      paymentTxHash
      seller {
        id
      }
      buyer {
        id
      }
    }
    receivedInvoices (
      first: $firstReceived
      skip: $skipReceived
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      contract
      createdAt
      id
      invoiceId
      paidAt
      price
      releasedAt
      state
      refundTxHash
      paymentToken {
        id
      }
      paymentTxHash
      seller {
        id
      }
      buyer {
        id
      }
    }
  }
}`;

export const paymentTokenQuery = `
  query PaymentToken($id: ID!) {
    paymentToken(id: $id) {
      id
      name
      decimal
    }
  }
`;

export const invoiceOwnerQuery = `query Invoice($id: String!) {
  invoice(id: $id) {
    seller {
      id
    }
  }
}`;

export const META_QUERY = `{
  _meta {
    block {
      number
      hash
    }
  }
}`;

export const INVOICE_SUBSCRIPTION = `
subscription {
  invoices {
    id
    invoiceId
    contract
    seller {
      id
    }
    buyer {
      id
    }
    state
    createdAt
    paidAt
    releasedAt
    paymentTxHash
    releaseHash
    price
    amountPaid
    fee
    creationTxHash
    commisionTxHash
  }
}
`;
