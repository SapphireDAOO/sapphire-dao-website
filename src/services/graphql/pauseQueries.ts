// Pause state and history from the subgraph.

/**
 * The singleton pause record plus the most recent actions.
 *
 * `emergencyPauseExpiry` matters more than it looks: the contract lets an
 * emergency pause lapse silently, with no event to index, so there is no
 * stored boolean that stays true only while it holds. Effective state has to
 * be derived against the clock — see `isEffectivelyPaused`.
 */
export const PAUSE_STATE_QUERY = `
  query PauseState {
    pauseState(id: "global") {
      id
      ownerPaused
      emergencyPauseExpiry
      emergencyPausedBy
      emergencyPausedAt
      lastAction
      lastActionBy
      lastActionAt
      lastActionTx
    }
    pauseActions(orderBy: timestamp, orderDirection: desc, first: 10) {
      id
      type
      account
      expiry
      timestamp
      block
      txHash
    }
  }
`;
