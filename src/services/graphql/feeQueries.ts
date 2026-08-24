// Queries over the fee-receiver entities: per-(receiver, token) balances that
// the processors have credited but the Sweeper has not yet moved out, plus the
// history of sweeps.

export const FEE_RECEIVER_BALANCES_QUERY = `
  query GetFeeReceiverBalances($first: Int! = 1000, $skip: Int! = 0) {
    feeReceiverTokenBalances(
      where: { balance_gt: "0" }
      orderBy: balance
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      accrued
      swept
      balance
      updatedAt
      feeReceiver {
        id
        address
        sweepCount
      }
      token {
        id
        name
        decimal
      }
    }
  }
`;

export const FEE_SWEEPS_QUERY = `
  query GetFeeSweeps($first: Int! = 10) {
    feeSweeps(orderBy: timestamp, orderDirection: desc, first: $first) {
      id
      destination
      amount
      timestamp
      txHash
      feeReceiver {
        id
        address
      }
      token {
        id
        name
        decimal
      }
    }
  }
`;
