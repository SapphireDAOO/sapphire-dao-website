// Websocket side of the hybrid metric flow: a live stream of metric deltas that
// the UI applies optimistically on top of the last subgraph snapshot between
// polls. The subgraph stays the source of truth for cumulative/historical
// values; the socket only nudges the live displayed figures.
//
// On reconnect or stale-session recovery the consumer should drop optimistic
// state and reseed from the subgraph 

// NOTE: intentionally NOT implemented yet. The factory and handle shape the UI
// subscribes to are defined here; the transport itself is a TODO.

import type { MetricsDelta, MetricsSocketStatus } from "./types";

export interface MetricsSocketHandlers {
  /** A live delta arrived; apply it optimistically over the current values. */
  onDelta: (delta: MetricsDelta) => void;
  /** Transport status changed; on reconnect the consumer should reseed. */
  onStatus?: (status: MetricsSocketStatus) => void;
}

export interface MetricsSocketHandle {
  /** Tear down the subscription and underlying transport. */
  close: () => void;
}

class NotImplementedError extends Error {
  constructor(what: string, chainId: number) {
    super(`${what} is not implemented yet (chainId ${chainId})`);
    this.name = "NotImplementedError";
  }
}

/**
 * Open the metrics websocket for a chain and route incoming deltas to the
 * handlers. Returns a handle the caller closes on unmount / chain change.
 *
 * Implementation outline (TODO):
 *  - open the websocket for `chainId`;
 *  - emit "connecting" → "open" via handlers.onStatus;
 *  - parse incoming messages into MetricsDelta and call handlers.onDelta;
 *  - on close/error emit the matching status so the consumer can reseed from
 *    the subgraph and discard optimistic state;
 *  - reconnect with backoff while the consumer keeps the handle open.
 */
export const createMetricsSocket = (
  chainId: number,
  handlers: MetricsSocketHandlers,
): MetricsSocketHandle => {
  // Referenced so the wiring is explicit until the transport lands.
  void handlers;
  throw new NotImplementedError("createMetricsSocket", chainId);
};
