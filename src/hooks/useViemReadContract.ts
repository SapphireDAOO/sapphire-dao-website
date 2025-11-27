"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { Abi, Address } from "viem";

type ReadContractParams<T> = {
  abi: Abi;
  address?: Address;
  functionName: string;
  args?: readonly unknown[];
  chainId?: number;
  account?: Address;
  enabled?: boolean;
  queryKey?: unknown[];
  select?: (value: unknown) => T;
};

export const useViemReadContract = <T = unknown>({
  abi,
  address,
  functionName,
  args,
  chainId,
  account,
  enabled = true,
  queryKey,
  select,
}: ReadContractParams<T>): UseQueryResult<T | undefined> => {
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey:
      queryKey ?? ["viem-read", chainId, address, functionName, args, account],
    enabled: Boolean(publicClient && address && enabled),
    queryFn: async () => {
      if (!publicClient || !address) return undefined as T | undefined;

      return (await publicClient.readContract({
        abi,
        address,
        functionName,
        args,
        account,
      })) as T;
    },
    select: (value) => (select ? select(value) : (value as T | undefined)),
  });
};
