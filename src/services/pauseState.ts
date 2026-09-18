import { client } from "@/services/graphql/client";
import { PAUSE_STATE_QUERY } from "@/services/graphql/pauseQueries";

export type PauseActionType =
  | "PAUSED"
  | "UNPAUSED"
  | "EMERGENCY_PAUSED"
  | "EMERGENCY_PAUSE_APPROVED";

export type PauseAction = {
  id: string;
  type: PauseActionType;
  account: string;
  expiry?: string | null;
  timestamp: string;
  block: string;
  txHash: string;
};

export type PauseState = {
  ownerPaused: boolean;
  emergencyPauseExpiry?: string | null;
  emergencyPausedBy?: string | null;
  emergencyPausedAt?: string | null;
  lastAction?: PauseActionType | null;
  lastActionBy?: string | null;
  lastActionAt?: string | null;
  lastActionTx?: string | null;
};

export type PauseSnapshot = {
  state: PauseState | null;
  actions: PauseAction[];
};

/**
 * Whether the protocol is paused right now.
 *
 * An owner pause stands until it is lifted. An emergency pause expires on its
 * own, and the contract emits nothing when it does, so the indexer cannot
 * record the transition: the only honest reading is to compare the stored
 * expiry against the clock.
 */
export const isEffectivelyPaused = (
  state: PauseState | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean => {
  if (!state) return false;
  if (state.ownerPaused) return true;

  const expiry = state.emergencyPauseExpiry
    ? Number(state.emergencyPauseExpiry)
    : 0;
  return expiry > 0 && nowSeconds < expiry;
};

/** Reads the pause singleton and recent actions. Null state when unindexed. */
export const fetchPauseSnapshot = async (
  chainId: number,
): Promise<PauseSnapshot> => {
  const result = await client(chainId)
    .query<{ pauseState: PauseState | null; pauseActions: PauseAction[] }>(
      PAUSE_STATE_QUERY,
      {},
      { requestPolicy: "network-only" },
    )
    .toPromise();

  if (result.error) throw new Error(result.error.message);

  return {
    state: result.data?.pauseState ?? null,
    actions: result.data?.pauseActions ?? [],
  };
};
