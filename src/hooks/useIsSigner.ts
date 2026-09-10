"use client";

import { useViemReadContract } from "./useViemReadContract";
import { Multisig } from "@/abis/MultiSig";
import { MULTISIG_CONTRACT, BASE_SEPOLIA } from "@/constants";
import { useChainId } from "wagmi";
import { Address } from "viem";

export const useIsSigner = (address?: Address) => {
  const chainId = useChainId() || BASE_SEPOLIA;
  return useViemReadContract<boolean>({
    abi: Multisig as never,
    chainId,
    address: MULTISIG_CONTRACT[chainId],
    functionName: "isSigner",
    args: address ? [address] : undefined,
    enabled: !!address,
  });
};
