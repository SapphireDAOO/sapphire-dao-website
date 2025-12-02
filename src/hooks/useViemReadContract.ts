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

// React Query hashes `queryKey` values with `JSON.stringify`, which throws on BigInt.
// Normalize any BigInt (and nested values) to string to keep the key serializable.
const serializeQueryKeyPart = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeQueryKeyPart);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        serializeQueryKeyPart(val),
      ]),
    );
  }

  return value;
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
  const normalizedQueryKey = serializeQueryKeyPart(
    queryKey ?? ["viem-read", chainId, address, functionName, args, account],
  ) as readonly unknown[];

  return useQuery({
    queryKey: normalizedQueryKey,
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
