import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import { INTERMEDIATED_PAYMENT_PROCESSOR } from "@/constants";

import { useAccount, useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

/**
 * Custom hook to fetch invoice data from the PaymentProcessor smart contract using an invoice key.
 *
 * This function calls `getInvoiceData(invoiceId)` on the contract and retrieves details
 * such as token address, amount, receiver address, and any other metadata stored in the invoice.
 *
 * @param invoiceId - The unique key (address) used to identify the invoice on-chain.
 *
 * @returns An object containing:
 *   - `data`: The invoice data returned by the contract. This is typically an object that includes fields like `token`, `amount`, `receiver`, etc.
 *   - `refetch`: A function to manually re-fetch the invoice data.
 *   - `isLoading`: Boolean indicating whether the contract read is currently in progress.
 */

export const useGetMarketplaceInvoiceData = (invoiceId: bigint | undefined) => {
  // Get the connected user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();

  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId() || BASE_SEPOLIA;
  const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];

  // Use the wagmi `useReadContract` hook to interact with the `getInvoiceData` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useViemReadContract({
    abi: intermediatedPaymentProcessor,
    // Read on the same chain the address was resolved for. Pinning this to
    // Base Sepolia sent the call to a contract that only exists elsewhere,
    // so the read always failed off that network.
    chainId,
    address: contractAddress,
    functionName: "getInvoice",
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    account: address,
    enabled: Boolean(invoiceId !== undefined && contractAddress),
  });

  return { data, refetch, isLoading };
};
