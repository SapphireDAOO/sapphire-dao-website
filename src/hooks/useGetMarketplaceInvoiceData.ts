import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { ADVANCED_PAYMENT_PROCESSOR } from "@/constants";

import { sepolia } from "viem/chains";
import { useAccount, useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";
import { ETHEREUM_SEPOLIA } from "@/constants";

/**
 * Custom hook to fetch invoice data from the PaymentProcessor smart contract using an invoice key.
 *
 * This function calls `getInvoiceData(orderId)` on the contract and retrieves details
 * such as token address, amount, receiver address, and any other metadata stored in the invoice.
 *
 * @param orderId - The unique key (address) used to identify the invoice on-chain.
 *
 * @returns An object containing:
 *   - `data`: The invoice data returned by the contract. This is typically an object that includes fields like `token`, `amount`, `receiver`, etc.
 *   - `refetch`: A function to manually re-fetch the invoice data.
 *   - `isLoading`: Boolean indicating whether the contract read is currently in progress.
 */

export const useGetMarketplaceInvoiceData = (orderId: bigint) => {
  // Get the connected user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();

  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId() || ETHEREUM_SEPOLIA;

  // Use the wagmi `useReadContract` hook to interact with the `getInvoiceData` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useViemReadContract({
    abi: advancedPaymentProcessor,
    chainId: sepolia.id,
    address: ADVANCED_PAYMENT_PROCESSOR[chainId],
    functionName: "getInvoice",
    args: [orderId],
    account: address,
  });


  console.log("result", data)

  return { data, refetch, isLoading };
};
