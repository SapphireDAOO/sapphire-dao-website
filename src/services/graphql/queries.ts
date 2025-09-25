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
    ownedInvoices {
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
      state
      buyer {
        id
      }
      seller {
        id
      }
    }
    paidInvoices {
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
      state
      seller {
        id
      }
      buyer {
        id
      }
    }
    issuedInvoices {
      amountPaid
      contract
      createdAt
      id
      invoiceId
      paidAt
      price
      releasedAt
      state
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
    receivedInvoices {
      amountPaid
      contract
      createdAt
      id
      invoiceId
      paidAt
      price
      releasedAt
      state
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

export const invoiceOwnerQuery = `query Invoice($id: String!) {
  invoice(id: $id) {
    seller {
      id
    }
  }
}`;
