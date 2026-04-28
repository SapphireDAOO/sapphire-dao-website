"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { Address } from "viem";
import {
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { useViemBlockNumber } from "./useViemBlockNumber";

type Params = {
  address?: Address;
  chainId?: number;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  watchBlock?: boolean;
};

export const useViemBalance = ({
  address,
  chainId,
  staleTime = DEFAULT_QUERY_STALE_TIME_MS,
  gcTime = DEFAULT_QUERY_GC_TIME_MS,
  refetchInterval = false,
  refetchOnWindowFocus = false,
  watchBlock = true,
}: Params) => {
  const publicClient = usePublicClient({ chainId });
  const { data: blockNumber } = useViemBlockNumber(
    chainId,
    Boolean(publicClient && address && watchBlock),
  );
  const blockKey = watchBlock ? blockNumber?.toString() : undefined;

  return useQuery({
    queryKey: ["viem-balance", chainId, address, blockKey],
    enabled: Boolean(publicClient && address),
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus,
    queryFn: async () => {
      if (!publicClient || !address) return undefined;

      return publicClient.getBalance({ address });
    },
  });
};
