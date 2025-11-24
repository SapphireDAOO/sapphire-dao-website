export const GET_ALL_INVOICES = `
  query {
    invoices {
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
      seller {
        id
      }
      buyer {
        id
      }
    }
    adminActions {
      id
      invoiceId
      time
      type
      action
      balance
      txHash
    }
  smartInvoices {
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
export const invoiceQuery = `query ($address: String!) {
  user (id: $address) {
    ownedInvoices (orderBy: lastActionTime, orderDirection: desc) {
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
    paidInvoices (orderBy: lastActionTime, orderDirection: desc) {
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
    issuedInvoices (orderBy: lastActionTime, orderDirection: desc) {
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
    receivedInvoices (orderBy: lastActionTime, orderDirection: desc) {
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
