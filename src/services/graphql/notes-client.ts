import { createClient } from "urql";
import { NOTES_GRAPH_API_URL } from "@/constants";

export const notesClient = (chainId: number) => {
  const url = NOTES_GRAPH_API_URL[chainId];
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
