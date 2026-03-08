import { createClient, type Client } from "urql";

const CLIENT_CACHE = new Map<number, Client>();

export const client = (chainId: number) => {
  const cached = CLIENT_CACHE.get(chainId);
  if (cached) return cached;

  const created = createClient({
    url: `/api/graphql?chainId=${chainId}`,
  });

  CLIENT_CACHE.set(chainId, created);
  return created;
};
