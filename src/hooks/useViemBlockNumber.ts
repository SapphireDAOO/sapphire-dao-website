"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

export const useViemBlockNumber = (chainId?: number, enabled = true) => {
  const publicClient = usePublicClient({ chainId });
  const [blockNumber, setBlockNumber] = useState<bigint>();

  useEffect(() => {
    if (!publicClient || !enabled) return;

    const unwatch = publicClient.watchBlockNumber({
      emitMissed: true,
      emitOnBegin: true,
      poll: true,
      pollingInterval: 12000,
      onBlockNumber: setBlockNumber,
      onError: (err) => console.error("blockNumber watch error", err),
    });

    return () => {
      unwatch?.();
    };
  }, [publicClient, enabled]);

  return { data: blockNumber };
};
