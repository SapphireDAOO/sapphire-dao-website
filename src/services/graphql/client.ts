import { createClient } from "urql";
import { THE_GRAPH_API_URL } from "@/constants";

export const client = (chainId: number) =>
  createClient({
    url: THE_GRAPH_API_URL[chainId],
  });
