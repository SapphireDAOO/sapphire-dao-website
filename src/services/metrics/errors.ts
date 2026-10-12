// graph-node store errors: the deployment is unhealthy, not the query wrong.
const INFRA_ERROR_PATTERNS = [/store error/i, /shard not found/i, /shard_/i];

export const METRICS_UNAVAILABLE_MESSAGE =
  "Metrics are temporarily unavailable because the subgraph indexer is having trouble. Please try again shortly.";

export const isSubgraphInfraError = (message: string): boolean =>
  INFRA_ERROR_PATTERNS.some((pattern) => pattern.test(message));

export const throwSubgraphError = (error: { message: string }): never => {
  if (isSubgraphInfraError(error.message)) {
    throw new Error(METRICS_UNAVAILABLE_MESSAGE);
  }
  throw new Error(error.message);
};
