"use client";

import { useQuery } from "@tanstack/react-query";
import { RATE_WINDOW_MS } from "@/constants";
import { fetchUsdPrices } from "@/services/exchangeRate";

/** USD per one unit of the token, or null when the API can't price it. */
export const useUsdPrice = (symbol: string) =>
  useQuery({
    queryKey: ["usd-price", symbol],
    queryFn: async ({ signal }) =>
      (await fetchUsdPrices([symbol], signal))[symbol] ?? null,
    staleTime: RATE_WINDOW_MS,
    refetchInterval: RATE_WINDOW_MS,
  });
