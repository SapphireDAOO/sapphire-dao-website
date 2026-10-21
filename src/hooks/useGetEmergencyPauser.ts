import { useChainId } from "wagmi";
import type { Address } from "viem";
import { BASE_SEPOLIA, PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";

// Changes only by a governance vote; usePauseState refreshes it on the event.
const PAUSER_STALE_TIME_MS = 60 * 60 * 1_000;

export const useGetEmergencyPauser = () => {
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract<Address>({
    abi: PaymentProcessorStorage,
    chainId,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getEmergencyPauser",
    staleTime: PAUSER_STALE_TIME_MS,
  });

  return { data, refetch, isLoading };
};
