// Queries scoped to a single user (dashboard, pay, checkout)

export const userInvoicesPageQuery = `
  query UserInvoicesPage(
    $address: String!
    $first: Int!
    $skip: Int!
    $includeOwned: Boolean!
    $includePaid: Boolean!
    $includeIssued: Boolean!
    $includeReceived: Boolean!
  ) {
    user(id: $address) {
      ownedInvoices(
        first: $first
        skip: $skip
        orderBy: lastActionTime
        orderDirection: desc
      ) @include(if: $includeOwned) {
        amountPaid
        contract
        createdAt
        fee
        id
        invoiceNonce
        paidAt
        paymentTxHash
        price
        releaseHash
        releasedAt
        refundTxHash
        invalidateAt
        expiresAt
        state
        buyer { id }
        seller { id }
        history
        historyTime
      }
      paidInvoices(
        first: $first
        skip: $skip
        orderBy: lastActionTime
        orderDirection: desc
      ) @include(if: $includePaid) {
        amountPaid
        contract
        createdAt
        fee
        id
        invoiceNonce
        paidAt
        paymentTxHash
        price
        releaseHash
        releasedAt
        refundTxHash
        invalidateAt
        expiresAt
        state
        buyer { id }
        seller { id }
        history
        historyTime
      }
      issuedInvoices(
        first: $first
        skip: $skip
        orderBy: lastActionTime
        orderDirection: desc
      ) @include(if: $includeIssued) {
        amountPaid
        amountReleased
        amountRefunded
        disputeSettledTxHash
        sellerAmountReceivedAfterDispute
        buyerAmountReceivedAfterDispute
        contract
        createdAt
        id
        invoiceNonce
        paidAt
        price
        releaseHash
        releasedAt
        state
        refundTxHash
        paymentToken { id }
        paymentTxHash
        seller { id }
        buyer { id }
        history
        historyTime
      }
      receivedInvoices(
        first: $first
        skip: $skip
        orderBy: lastActionTime
        orderDirection: desc
      ) @include(if: $includeReceived) {
        amountPaid
        amountReleased
        amountRefunded
        disputeSettledTxHash
        sellerAmountReceivedAfterDispute
        buyerAmountReceivedAfterDispute
        contract
        createdAt
        id
        invoiceNonce
        paidAt
        price
        releaseHash
        releasedAt
        state
        refundTxHash
        paymentToken { id }
        paymentTxHash
        seller { id }
        buyer { id }
        history
        historyTime
      }
    }
  }
`;

export const invoiceQuery = `query (
  $address: String!
  $first: Int! = 24
  $skip: Int! = 0
) {
  user (id: $address) {
    ownedInvoices (
      first: $first
      skip: $skip
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
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
      refundTxHash
      invalidateAt
      expiresAt
      state
      buyer { id }
      seller { id }
      history
      historyTime
    }
    paidInvoices (
      first: $first
      skip: $skip
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      contract
      createdAt
      fee
      id
      invoiceId: invoiceNonce
      paidAt
      paymentTxHash
      price
      releaseHash
      refundTxHash
      releasedAt
      invalidateAt
      expiresAt
      state
      seller { id }
      buyer { id }
      history
      historyTime
    }
    issuedInvoices (
      first: $first
      skip: $skip
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      amountReleased
      amountRefunded
      disputeSettledTxHash
      sellerAmountReceivedAfterDispute
      buyerAmountReceivedAfterDispute
      contract
      createdAt
      id
      invoiceId: invoiceNonce
      paidAt
      price
      releaseHash
      releasedAt
      state
      refundTxHash
      paymentToken { id }
      paymentTxHash
      seller { id }
      buyer { id }
      history
      historyTime
    }
    receivedInvoices (
      first: $first
      skip: $skip
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      amountReleased
      amountRefunded
      disputeSettledTxHash
      sellerAmountReceivedAfterDispute
      buyerAmountReceivedAfterDispute
      contract
      createdAt
      id
      invoiceId: invoiceNonce
      paidAt
      price
      releaseHash
      releasedAt
      state
      refundTxHash
      paymentToken { id }
      paymentTxHash
      seller { id }
      buyer { id }
      history
      historyTime
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

const paymentTokensFragment = `
  paymentTokens(first: 5) {
    id
    name
    decimal
  }
`;

export const smartInvoiceQuery = `
  query ($id: ID!) {
    smartInvoice: advancedPaymentProcessor(id: $id) {
      amountPaid
      amountReleased
      amountRefunded
      disputeSettledTxHash
      sellerAmountReceivedAfterDispute
      buyerAmountReceivedAfterDispute
      contract
      createdAt
      escrow
      id
      invoiceId: invoiceNonce
      paidAt
      paymentToken { id }
      price
      paymentTxHash
      releaseHash
      refundTxHash
      releasedAt
      state
      seller { id }
      buyer { id }
      history
      historyTime
    }
    ${paymentTokensFragment}
  }
`;

export const metaInvoiceQuery = `
  query ($id: ID!) {
    metaInvoice(id: $id) {
      contract
      id
      invoiceId
      price
    }
    ${paymentTokensFragment}
  }
`;

export const invoiceOwnerQuery = `query Invoice($id: ID!) {
  invoice: simplePaymentProcessor(id: $id) {
    seller { id }
  }
}`;
