"use client";

import { useViemReadContract } from "./useViemReadContract";
import { Multisig } from "@/abis/MultiSig";
import { MULTISIG_CONTRACT, BASE_SEPOLIA } from "@/constants";
import { useChainId } from "wagmi";
import { baseSepolia } from "viem/chains";
import { Address, Hex } from "viem";

export const useHasApproved = (txHash?: Hex, address?: Address) => {
  const chainId = useChainId() || BASE_SEPOLIA;
  return useViemReadContract<boolean>({
    abi: Multisig as never,
    chainId: baseSepolia.id,
    address: MULTISIG_CONTRACT[chainId],
    functionName: "hasApproved",
    args: txHash && address ? [txHash, address] : undefined,
    enabled: !!txHash && !!address,
    queryKey: ["hasApproved", chainId, txHash, address],
  });
};
