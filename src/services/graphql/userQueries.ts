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
      ownedSimpleInvoices(
        first: $first
        skip: $skip
        orderBy: lastActionTime
        orderDirection: desc
      ) @include(if: $includeOwned) {
        amountPaid
        contract
        fee
        id
        invoiceNonce
        price
        invalidateAt
        expiresAt
        state
        releaseAt
        lastActionTime
        buyer { id }
        seller { id }
        events { eventType txHash timestamp }
      }
      paidSimpleInvoices(
        first: $first
        skip: $skip
        orderBy: lastActionTime
        orderDirection: desc
      ) @include(if: $includePaid) {
        amountPaid
        contract
        fee
        id
        invoiceNonce
        price
        invalidateAt
        expiresAt
        state
        releaseAt
        lastActionTime
        buyer { id }
        seller { id }
        events { eventType txHash timestamp }
      }
      issuedAdvancedInvoices(
        first: $first
        skip: $skip
        orderBy: lastActionTime
        orderDirection: desc
      ) @include(if: $includeIssued) {
        amountPaid
        amountReleased
        amountRefunded
        sellerAmountReceivedAfterDispute
        buyerAmountReceivedAfterDispute
        contract
        id
        invoiceNonce
        price
        state
        releaseAt
        lastActionTime
        paymentToken { id }
        seller { id }
        buyer { id }
        events { eventType txHash timestamp }
      }
      receivedAdvancedInvoices(
        first: $first
        skip: $skip
        orderBy: lastActionTime
        orderDirection: desc
      ) @include(if: $includeReceived) {
        amountPaid
        amountReleased
        amountRefunded
        sellerAmountReceivedAfterDispute
        buyerAmountReceivedAfterDispute
        contract
        id
        invoiceNonce
        price
        state
        releaseAt
        lastActionTime
        paymentToken { id }
        seller { id }
        buyer { id }
        events { eventType txHash timestamp }
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
    ownedSimpleInvoices (
      first: $first
      skip: $skip
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      contract
      fee
      id
      invoiceId: invoiceNonce
      price
      invalidateAt
      expiresAt
      state
      releaseAt
      lastActionTime
      buyer { id }
      seller { id }
      events { eventType txHash timestamp }
    }
    paidSimpleInvoices (
      first: $first
      skip: $skip
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      contract
      fee
      id
      invoiceId: invoiceNonce
      price
      invalidateAt
      expiresAt
      state
      releaseAt
      lastActionTime
      seller { id }
      buyer { id }
      events { eventType txHash timestamp }
    }
    issuedAdvancedInvoices (
      first: $first
      skip: $skip
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      amountReleased
      amountRefunded
      sellerAmountReceivedAfterDispute
      buyerAmountReceivedAfterDispute
      contract
      id
      invoiceId: invoiceNonce
      price
      state
      releaseAt
      lastActionTime
      paymentToken { id }
      seller { id }
      buyer { id }
      events { eventType txHash timestamp }
    }
    receivedAdvancedInvoices (
      first: $first
      skip: $skip
      orderBy: lastActionTime
      orderDirection: desc
    ) {
      amountPaid
      amountReleased
      amountRefunded
      sellerAmountReceivedAfterDispute
      buyerAmountReceivedAfterDispute
      contract
      id
      invoiceId: invoiceNonce
      price
      state
      releaseAt
      lastActionTime
      paymentToken { id }
      seller { id }
      buyer { id }
      events { eventType txHash timestamp }
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
      sellerAmountReceivedAfterDispute
      buyerAmountReceivedAfterDispute
      contract
      escrow
      id
      invoiceId: invoiceNonce
      paymentToken { id }
      price
      state
      releaseAt
      lastActionTime
      seller { id }
      buyer { id }
      events { eventType txHash timestamp }
    }
    ${paymentTokensFragment}
  }
`;

export const metaInvoiceQuery = `
  query ($id: ID!) {
    metaInvoice(id: $id) {
      contract
      id
      invoiceId: invoiceNonce
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
