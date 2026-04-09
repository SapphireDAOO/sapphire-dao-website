import { PAYMENT_PROCESSOR_STORAGE, BASE_SEPOLIA } from "@/constants";
import { baseSepolia } from "viem/chains";
import { useChainId } from "wagmi";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";

/**
 * Fetches the current invoice validity period (in seconds) from the PaymentProcessorStorage contract.
 */
export const useGetValidPeriod = () => {
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract({
    abi: PaymentProcessorStorage,
    chainId: baseSepolia.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getPaymentValidityDuration",
  });

  return { data, refetch, isLoading };
};
