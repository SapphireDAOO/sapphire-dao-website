import { SIMPLE_PAYMENT_PROCESSOR, BASE_SEPOLIA } from "@/constants";
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
    chainId,
    address: SIMPLE_PAYMENT_PROCESSOR[chainId],
    functionName: "getDecisionWindow",
  });

  return { data, refetch, isLoading };
};
