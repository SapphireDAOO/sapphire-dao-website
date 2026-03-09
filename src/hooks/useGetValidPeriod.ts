import { SIMPLE_PAYMENT_PROCESSOR, BASE_SEPOLIA } from "@/constants";
import { baseSepolia } from "viem/chains";
import { useChainId } from "wagmi";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { useViemReadContract } from "./useViemReadContract";

/**
 * Fetches the current invoice validity period (in seconds) from the PaymentProcessor contract.
 */
export const useGetValidPeriod = () => {
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract({
    abi: paymentProcessor,
    chainId: baseSepolia.id,
    address: SIMPLE_PAYMENT_PROCESSOR[chainId],
    functionName: "validPeriod",
  });

  return { data, refetch, isLoading };
};
