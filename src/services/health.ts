import { CONTRACT_API_URL } from "@/constants";

export type ApiHealth = {
  reachable: boolean;

  time?: string;
  error?: string;
};

export const fetchApiHealth = async (
  signal?: AbortSignal,
): Promise<ApiHealth> => {
  try {
    const response = await fetch(`${CONTRACT_API_URL}/`, {
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      return { reachable: false, error: `HTTP ${response.status}` };
    }

    const payload = (await response.json()) as {
      status?: string;
      time?: string;
    };
    return {
      reachable: payload?.status === "ok",
      time: payload?.time,
      error: payload?.status === "ok" ? undefined : "Unexpected response",
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Unreachable",
    };
  }
};
