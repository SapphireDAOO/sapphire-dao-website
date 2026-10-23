import {
  createClient,
  cacheExchange,
  dedupExchange,
  fetchExchange,
  type Client,
} from "urql";
import { BASE_SEPOLIA, THE_GRAPH_API_URL } from "@/constants";

// urql's cache never expires, so each client is replaced after this long.
export const CLIENT_CACHE_LIFETIME_MS = 60_000;

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

export const client = expiringClients((chainId) =>
  createClient({
    url: THE_GRAPH_API_URL[chainId] ?? THE_GRAPH_API_URL[BASE_SEPOLIA],
    requestPolicy: "cache-first",
    // dedupExchange isn't in urql v3's defaults.
    exchanges: [dedupExchange, cacheExchange, fetchExchange],
  }),
);
