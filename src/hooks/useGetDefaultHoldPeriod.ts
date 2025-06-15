import { INVOICE_ADDRESS } from "@/constants";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { polygonAmoy } from "wagmi/chains";
import { useAccount, useChainId, useReadContract } from "wagmi";

/**
 * Custom hook to retrieve the default hold period from the PaymentProcessor smart contract.
 *
 * @returns  - An object containing:
 *   - `data`: The default hold period returned by the smart contract.
 *   - `refetch`: A function to manually refetch the contract data.
 *   - `isLoading`: A boolean indicating whether the contract call is still loading.
 */
export const useGetDefaultHoldPeriod = () => {
  // Retrieve the current user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();

  // Retrieve the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId();

  // Use the `useReadContract` hook to call the `getDefaultHoldPeriod` function from the PaymentProcessor contract
  const { data, refetch, isLoading } = useReadContract({
    abi: paymentProcessor,
    chainId: polygonAmoy.id,
    address: INVOICE_ADDRESS[chainId],
    functionName: "getDefaultHoldPeriod",
    account: address,
  });

  return { data, refetch, isLoading };
};
