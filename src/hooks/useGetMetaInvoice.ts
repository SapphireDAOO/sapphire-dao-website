import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { ADVANCED_PAYMENT_PROCESSOR } from "@/constants";

import { sepolia } from "viem/chains";
import { useAccount, useChainId, useReadContract } from "wagmi";

/**
 * Custom hook to fetch a meta invoice from the AdvancedPaymentProcessor smart contract.
 *
 * @param orderId - The unique identifier (key) of the invoice.
 *
 * @returns An object containing:
 *   - `data`: The meta invoice data returned by the smart contract. This may include fields like `token`, `amount`, `receiver`, etc.
 *   - `refetch`: A function to manually re-fetch the data.
 *   - `isLoading`: Boolean indicating whether the contract read operation is still in progress.
 */

export const useGetMetaInvoice = (orderId: bigint) => {
  // Get the connected user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();

  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId();

  // Use the wagmi `useReadContract` hook to interact with the `getMetaInvoice` function of the AdvancedPaymentProcessor contract
  const { data, refetch, isLoading } = useReadContract({
    abi: advancedPaymentProcessor,
    chainId: sepolia.id,
    address: ADVANCED_PAYMENT_PROCESSOR[chainId],
    functionName: "getMetaInvoice",
    args: [orderId],
    account: address,
  });

  return { data, refetch, isLoading };
};
