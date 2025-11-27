"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { Address } from "viem";

type Params = {
  address?: Address;
  chainId?: number;
};

export const useViemBalance = ({ address, chainId }: Params) => {
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["viem-balance", chainId, address],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address) return undefined;

      return publicClient.getBalance({ address });
    },
  });
};
