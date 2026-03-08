import { createClient, type Client } from "urql";
import { THE_GRAPH_API_URL } from "@/constants";

const NOTES_CLIENT_CACHE = new Map<number, Client>();

export const notesClient = (chainId: number) => {
  const cached = NOTES_CLIENT_CACHE.get(chainId);
  if (cached) return cached;

  if (!THE_GRAPH_API_URL[chainId]) return null;

  const created = createClient({
    url: `/api/graphql?chainId=${chainId}`,
  });

  NOTES_CLIENT_CACHE.set(chainId, created);
  return created;
};
