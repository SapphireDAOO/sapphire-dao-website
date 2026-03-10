import { createClient, cacheExchange, fetchExchange, type Client } from "urql";

const CLIENT_CACHE = new Map<number, Client>();

/**
 * Returns a urql client for the given chainId.
 * `cache-and-network` policy (from the Uniswap pattern): immediately returns
 * cached data while fetching fresh data in the background, preventing blank
 * loading states on re-renders.
 */
export const client = (chainId: number) => {
  const cached = CLIENT_CACHE.get(chainId);
  if (cached) return cached;

  const created = createClient({
    url: `/api/graphql?chainId=${chainId}`,
    requestPolicy: "cache-and-network",
    exchanges: [cacheExchange, fetchExchange],
  });

  CLIENT_CACHE.set(chainId, created);
  return created;
};
