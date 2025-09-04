import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";

import { sepolia } from "viem/chains";
import { useChainId, useReadContract } from "wagmi";

export const useGetMarketplaceWallet = () => {
  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId();

  // Use the wagmi `useReadContract` hook to interact with the `getMarketplace` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useReadContract({
    abi: PaymentProcessorStorage,
    chainId: sepolia.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getMarketplace",
  });

  return { data, refetch, isLoading };
};
