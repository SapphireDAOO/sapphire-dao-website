import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { sepolia } from "wagmi/chains";
import { useChainId, useReadContract } from "wagmi";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";

/**
 * Custom hook to retrieve the default hold period from the PaymentProcessor smart contract.
 *
 * @returns  - An object containing:
 *   - `data`: The default hold period returned by the smart contract.
 *   - `refetch`: A function to manually refetch the contract data.
 *   - `isLoading`: A boolean indicating whether the contract call is still loading.
 */
export const useGetDefaultHoldPeriod = () => {
  // Retrieve the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId();

  // Use the `useReadContract` hook to call the `getDefaultHoldPeriod` function from the PaymentProcessor contract
  const { data, refetch, isLoading } = useReadContract({
    abi: PaymentProcessorStorage,
    chainId: sepolia.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getDefaultHoldPeriod",
  });

  return { data, refetch, isLoading };
};
