import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";

import { baseSepolia } from "viem/chains";
import { useChainId } from "wagmi";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

/**
 * Custom hook to retrieve the transaction fee from the PaymentProcessor smart contract.
 *
 * @returns  - An object containing:
 *   - `data`: The fee amount retrieved from the smart contract.
 *   - `refetch`: A function to manually refetch the fee from the contract.
 *   - `isLoading`: A boolean indicating whether the fee data is still being fetched.
 */
export const useGetFeeRate = () => {
  // Get the connected user's wallet address using the wagmi `useAccount` hook

  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract({
    abi: PaymentProcessorStorage,
    chainId: baseSepolia.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getFeeRate",
  });

  return { data, refetch, isLoading };
};
