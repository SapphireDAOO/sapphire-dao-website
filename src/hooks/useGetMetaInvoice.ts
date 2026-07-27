import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import { INTERMEDIATED_PAYMENT_PROCESSOR } from "@/constants";

import { baseSepolia } from "viem/chains";
import { useAccount, useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

/**
 * Custom hook to fetch a meta invoice from the IntermediatedPaymentProcessor smart contract.
 *
 * @param invoiceId - The unique identifier (key) of the invoice.
 *
 * @returns An object containing:
 *   - `data`: The meta invoice data returned by the smart contract. This may include fields like `token`, `amount`, `receiver`, etc.
 *   - `refetch`: A function to manually re-fetch the data.
 *   - `isLoading`: Boolean indicating whether the contract read operation is still in progress.
 */

export const useGetMetaInvoice = (invoiceId: bigint) => {
  // Get the connected user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();

  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId() || BASE_SEPOLIA;

  // Use the wagmi `useReadContract` hook to interact with the `getMetaInvoice` function of the IntermediatedPaymentProcessor contract
  const { data, refetch, isLoading } = useViemReadContract({
    abi: intermediatedPaymentProcessor,
    chainId: baseSepolia.id,
    address: INTERMEDIATED_PAYMENT_PROCESSOR[chainId],
    functionName: "getMetaInvoice",
    args: [invoiceId],
    account: address,
  });

  return { data, refetch, isLoading };
};
