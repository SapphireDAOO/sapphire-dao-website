import {
  createClient,
  cacheExchange,
  dedupExchange,
  fetchExchange,
  type Client,
} from "urql";

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
    // cache-first: serve from urql's in-memory cache when available and only
    // hit the network when the cache is empty. Real-time freshness is handled
    // by event-based refresh calls (watchEvent) rather than background refetches.
    // The server-side proxy (/api/graphql) adds a 15-second cache layer on top.
    // Fetchers wrapped by react-query (metrics) opt into network-only per query
    // so react-query stays the single caching/freshness layer for them.
    requestPolicy: "cache-first",
    // dedupExchange collapses identical in-flight queries into one request
    // (not part of the default exchanges in urql v3).
    exchanges: [dedupExchange, cacheExchange, fetchExchange],
  });

  CLIENT_CACHE.set(chainId, created);
  return created;
};
