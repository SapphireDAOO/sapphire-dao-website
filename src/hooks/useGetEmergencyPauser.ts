import { useAccount, useChainId } from "wagmi";
import type { Address } from "viem";
import { BASE_SEPOLIA, PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";

/**
 * The address allowed to trip the emergency pause.
 *
 * `useEmergencyPause` reads this too, alongside the live pause state. This is
 * the bare read on its own, for callers that only need to know who the pauser
 * is, without pulling in the pause state and its refresh timers.
 */
export const useGetEmergencyPauser = () => {
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract<Address>({
    abi: PaymentProcessorStorage,
    chainId,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getEmergencyPauser",
    account: address,
  });

  return { data, refetch, isLoading };
};
