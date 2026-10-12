// An emergency pause lapses with no event, so effective state is
// derived from emergencyPauseExpiry; see isEffectivelyPaused.
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
