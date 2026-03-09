import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";

import { baseSepolia } from "viem/chains";
import { useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

export const useGetMarketplaceWallet = () => {
  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId() || BASE_SEPOLIA;

  // Use the wagmi `useReadContract` hook to interact with the `getMarketplace` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useViemReadContract<string>({
    abi: PaymentProcessorStorage,
    chainId: baseSepolia.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getMarketplace",
  });

  return { data, refetch, isLoading };
};
