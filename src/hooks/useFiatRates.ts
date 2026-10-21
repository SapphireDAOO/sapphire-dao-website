"use client";

import { useQuery } from "@tanstack/react-query";
import { RATE_WINDOW_MS } from "@/constants";
import { fetchUsdPrices } from "@/services/exchangeRate";
import { fetchFiatRates } from "@/services/fiatRates";

const ONE_HOUR_MS = 60 * 60 * 1_000;

export const useFiatRates = () =>
  useQuery({
    queryKey: ["fiat-rates"],
    queryFn: ({ signal }) => fetchFiatRates(signal),
    staleTime: ONE_HOUR_MS,
  });

/** USD per one unit of the token, or null when the API can't price it. */
export const useUsdPrice = (symbol: string) =>
  useQuery({
    queryKey: ["usd-price", symbol],
    queryFn: async ({ signal }) =>
      (await fetchUsdPrices([symbol], signal))[symbol] ?? null,
    staleTime: RATE_WINDOW_MS,
    refetchInterval: RATE_WINDOW_MS,
  });
