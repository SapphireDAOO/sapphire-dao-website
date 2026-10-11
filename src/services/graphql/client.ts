import {
  createClient,
  cacheExchange,
  dedupExchange,
  fetchExchange,
  type Client,
} from "urql";
import { BASE_SEPOLIA, THE_GRAPH_API_URL } from "@/constants";

// urql's document cache has no expiry, and the only thing that evicts from it
// is a mutation result, which this app never sends. So rather than keep one
// client per chain for the life of the tab, each is replaced once it is this
// old, and its cache goes with it. That bounds how stale a cache-first answer
// can be and how much the cache can hold.
export const CLIENT_CACHE_LIFETIME_MS = 60_000;

/**
 * Memoizes a per-chain client factory, building a fresh client (with an empty
 * cache) for a chain once its current one is older than
 * CLIENT_CACHE_LIFETIME_MS. Callers fetch the client on every query rather
 * than holding one, so the swap needs nothing from them.
 */
export const expiringClients = <C extends Client | null>(
  create: (chainId: number) => C,
) => {
  const clients = new Map<number, { client: C; createdAt: number }>();

  return (chainId: number): C => {
    const cached = clients.get(chainId);
    if (cached && Date.now() - cached.createdAt < CLIENT_CACHE_LIFETIME_MS) {
      return cached.client;
    }

    const created = create(chainId);
    clients.set(chainId, { client: created, createdAt: Date.now() });
    return created;
  };
};

/**
 * Returns the urql client for the given chainId, cache-first.
 *
 * A query repeated with the same variables is answered from the cache until
 * the client expires (CLIENT_CACHE_LIFETIME_MS), which keeps remounts and tab
 * switches off the rate-limited endpoint. A call that must see changes made
 * since (a retry, a refresh after a write, a return to the tab) passes
 * `{ requestPolicy: "network-only" }`. Fetchers with their own cache
 * (react-query, the admin TTL) pass it on every call so that cache stays the
 * single freshness layer for them.
 */
export const client = expiringClients((chainId) =>
  createClient({
    // Query the subgraph directly from the browser; unsupported chains fall
    // back to the Base Sepolia endpoint (mirrors the old proxy's default).
    url: THE_GRAPH_API_URL[chainId] ?? THE_GRAPH_API_URL[BASE_SEPOLIA],
    requestPolicy: "cache-first",
    // dedupExchange collapses identical in-flight queries into one request
    // (not part of the default exchanges in urql v3).
    exchanges: [dedupExchange, cacheExchange, fetchExchange],
  }),
);
