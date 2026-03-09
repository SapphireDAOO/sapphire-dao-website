import { SIMPLE_PAYMENT_PROCESSOR, BASE_SEPOLIA } from "@/constants";
import { baseSepolia } from "viem/chains";
import { useChainId } from "wagmi";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { useViemReadContract } from "./useViemReadContract";

/**
 * Fetches the current decision window (in seconds) from the PaymentProcessor contract.
 */
export const useGetDecisionWindow = () => {
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract({
    abi: paymentProcessor,
    chainId: baseSepolia.id,
    address: SIMPLE_PAYMENT_PROCESSOR[chainId],
    functionName: "decisionWindow",
  });

  return { data, refetch, isLoading };
};
