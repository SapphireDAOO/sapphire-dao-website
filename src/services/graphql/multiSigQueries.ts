export const MULTISIG_WALLET_QUERY = `
  query GetMultiSigWallet($id: ID!) {
    multiSigWallet(id: $id) {
      id
      threshold
      signerCount
      transactionCount
      signers(where: { active: true }) {
        id
        address
        active
        addedAt
      }
    }
  }
`;

export const MULTISIG_TRANSACTIONS_QUERY = `
  query GetMultiSigTransactions($walletId: String!, $first: Int! = 20, $skip: Int! = 0) {
    multiSigTransactions(
      where: { wallet: $walletId }
      orderBy: proposedAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      target
      value
      data
      nonce
      proposer
      status
      approvalCount
      proposedAt
      executedAt
      executor
    }
  }
`;
