"use client";

import { useEffect, useRef } from "react";
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

  const query = useQuery({
    // Stable key: keying by block number made every new block a brand-new
    // query — the UI flashed "Loading..." on each block and a day-retained
    // cache entry piled up per block. New blocks refresh in the background
    // below instead.
    queryKey: ["viem-balance", chainId, address],
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

  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;
  const hasDataRef = useRef(false);
  hasDataRef.current = query.data !== undefined;

  useEffect(() => {
    if (!watchBlock || blockNumber === undefined) return;
    // Skip until the initial fetch has resolved; after that each new block
    // triggers a silent background refetch (isLoading stays false).
    if (!hasDataRef.current) return;
    void refetchRef.current();
  }, [blockNumber, watchBlock]);

  return query;
};
