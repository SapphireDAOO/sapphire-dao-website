import { paymentProcessor } from "@/abis/PaymentProcessor";
import { SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { sepolia } from "viem/chains";
import { useAccount, useChainId, useReadContract } from "wagmi";

/**
 * Custom hook to fetch the minimum invoice value required by the PaymentProcessor contract.
 *
 * @returns An object containing:
 *   - `data`: The minimum invoice value (likely a `bigint`) returned by the smart contract.
 *   - `refetch`: A function to manually re-fetch the value from the contract.
 *   - `isLoading`: Boolean indicating whether the contract read is currently in progress.
 */

export const useGetMinimumInvoiceValue = () => {
  // Get the connected user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();

  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId();

  // Use the wagmi `useReadContract` hook to interact with the `getMinimumInvoiceValue` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useReadContract({
    abi: paymentProcessor,
    chainId: sepolia.id,
    address: SIMPLE_PAYMENT_PROCESSOR[chainId],
    functionName: "getMinimumInvoiceValue",
    account: address,
  });

  return { data, refetch, isLoading };
};
