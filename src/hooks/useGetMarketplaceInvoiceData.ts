import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { ADVANCE_INVOICE_ADDRESS } from "@/constants";
import { Address } from "viem";

import { polygonAmoy } from "viem/chains";
import { useAccount, useChainId, useReadContract } from "wagmi";

/**
 * Custom hook to fetch invoice data from the PaymentProcessor smart contract using an invoice key.
 *
 * This function calls `getInvoiceData(invoiceKey)` on the contract and retrieves details
 * such as token address, amount, receiver address, and any other metadata stored in the invoice.
 *
 * @param invoiceKey - The unique key (address) used to identify the invoice on-chain.
 *
 * @returns An object containing:
 *   - `data`: The invoice data returned by the contract. This is typically an object that includes fields like `token`, `amount`, `receiver`, etc.
 *   - `refetch`: A function to manually re-fetch the invoice data.
 *   - `isLoading`: Boolean indicating whether the contract read is currently in progress.
 */

export const useGetMarketplaceInvoiceData = (invoiceKey: Address) => {
  // Get the connected user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();

  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId();

  // Use the wagmi `useReadContract` hook to interact with the `getInvoiceData` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useReadContract({
    abi: advancedPaymentProcessor,
    chainId: polygonAmoy.id,
    address: ADVANCE_INVOICE_ADDRESS[chainId],
    functionName: "getInvoice",
    args: [invoiceKey],
    account: address,
  });

  return { data, refetch, isLoading };
};
