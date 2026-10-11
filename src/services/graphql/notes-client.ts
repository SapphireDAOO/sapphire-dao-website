import { createClient } from "urql";
import { THE_GRAPH_API_URL } from "@/constants";
import { expiringClients } from "./client";

// Replaced on the same schedule as the main subgraph client, so its cache is
// bounded the same way. Null where no subgraph is configured.
export const notesClient = expiringClients((chainId) => {
  const url = THE_GRAPH_API_URL[chainId];
  return url ? createClient({ url }) : null;
});
