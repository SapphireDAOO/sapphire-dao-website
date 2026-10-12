import { createClient } from "urql";
import { THE_GRAPH_API_URL } from "@/constants";
import { expiringClients } from "./client";

export const notesClient = expiringClients((chainId) => {
  const url = THE_GRAPH_API_URL[chainId];
  return url ? createClient({ url }) : null;
});
