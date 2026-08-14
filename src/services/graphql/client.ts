import {
  createClient,
  cacheExchange,
  dedupExchange,
  fetchExchange,
  type Client,
} from "urql";
import { BASE_SEPOLIA, THE_GRAPH_API_URL } from "@/constants";

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
    // Query the subgraph directly from the browser; unsupported chains fall
    // back to the Base Sepolia endpoint (mirrors the old proxy's default).
    url: THE_GRAPH_API_URL[chainId] ?? THE_GRAPH_API_URL[BASE_SEPOLIA],
    // cache-first: serve from urql's in-memory cache when available and only
    // hit the network when the cache is empty. Real-time freshness is handled
    // by event-based refresh calls (watchEvent) rather than background refetches.
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
