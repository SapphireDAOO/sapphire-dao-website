"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

export const useViemBlockNumber = (chainId?: number) => {
  const publicClient = usePublicClient({ chainId });
  const [blockNumber, setBlockNumber] = useState<bigint>();

  useEffect(() => {
    if (!publicClient) return;

    const unwatch = publicClient.watchBlockNumber({
      emitMissed: true,
      emitOnBegin: true,
      onBlockNumber: setBlockNumber,
      onError: (err) => console.error("blockNumber watch error", err),
    });

    return () => {
      unwatch?.();
    };
  }, [publicClient]);

  return { data: blockNumber };
};
