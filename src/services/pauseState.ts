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
 * An emergency pause expires without an event,
 * so its expiry is compared against the clock.
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

export const fetchPauseSnapshot = async (
  chainId: number,
): Promise<PauseSnapshot> => {
  const result = await client(chainId)
    .query<{ pauseState: PauseState | null; pauseActions: PauseAction[] }>(
      PAUSE_STATE_QUERY,
      {},
    )
    .toPromise();

  if (result.error) throw new Error(result.error.message);

  return {
    state: result.data?.pauseState ?? null,
    actions: result.data?.pauseActions ?? [],
  };
};
