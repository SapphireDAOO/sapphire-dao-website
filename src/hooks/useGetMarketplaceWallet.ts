import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { ADVANCED_PAYMENT_PROCESSOR } from "@/constants";

import { sepolia } from "viem/chains";
import { useChainId, useReadContract } from "wagmi";

export const useGetMarketplaceWallet = () => {
  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId();

  // Use the wagmi `useReadContract` hook to interact with the `getMarketplace` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useReadContract({
    abi: advancedPaymentProcessor,
    chainId: sepolia.id,
    address: ADVANCED_PAYMENT_PROCESSOR[chainId],
    functionName: "getMarketplace",
  });

  return { data, refetch, isLoading };
};
