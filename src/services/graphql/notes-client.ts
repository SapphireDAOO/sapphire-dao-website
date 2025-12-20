import { createClient } from "urql";
import { THE_GRAPH_API_URL } from "@/constants";

export const notesClient = (chainId: number) => {
  const url = THE_GRAPH_API_URL[chainId];
  if (!url) return null;

  return createClient({
    url,
    fetchOptions: {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_GRAPH_API_KEY}`,
      },
    },
  });
};
