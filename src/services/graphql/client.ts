import { createClient } from "urql";
import { THE_GRAPH_API_URL } from "@/constants";

export const client = (chainId: number) =>
  createClient({
    url: THE_GRAPH_API_URL[chainId],
    fetchOptions: {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_GRAPH_API_KEY}`,
      },
    },
  });
