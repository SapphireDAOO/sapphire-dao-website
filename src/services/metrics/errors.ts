/**
 * Graph-node infrastructure errors (as opposed to query errors). These come
 * from the indexer's store layer — e.g. "Store error: shard not found:
 * shard_bb (this usually indicates a misconfiguration)" — and mean the subgraph
 * deployment is unhealthy/misconfigured on The Graph's side, not that our query
 * is wrong. There is nothing the client can do except surface a graceful state.
 */
const INFRA_ERROR_PATTERNS = [/store error/i, /shard not found/i, /shard_/i];

/** User-facing message shown when the subgraph indexer is misbehaving. */
export const METRICS_UNAVAILABLE_MESSAGE =
  "Metrics are temporarily unavailable because the subgraph indexer is having trouble. Please try again shortly.";

/** True when `message` looks like a graph-node store/shard infrastructure error. */
export const isSubgraphInfraError = (message: string): boolean =>
  INFRA_ERROR_PATTERNS.some((pattern) => pattern.test(message));

/**
 * Normalise a urql/GraphQL error before it reaches the UI: transient graph-node
 * store errors become a friendly "temporarily unavailable" message; anything
 * else is re-thrown as-is. Always throws — its return type is `never`.
 */
export const throwSubgraphError = (error: { message: string }): never => {
  if (isSubgraphInfraError(error.message)) {
    throw new Error(METRICS_UNAVAILABLE_MESSAGE);
  }
  throw new Error(error.message);
};
