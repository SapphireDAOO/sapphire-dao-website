import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";

import { polygonAmoy } from "wagmi/chains";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";

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
  const { address } = useAccount();

  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId();

  const { data, refetch, isLoading } = useReadContract({
    abi: PaymentProcessorStorage,
    chainId: polygonAmoy.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getFeeRate",
    account: address,
  });

  return { data, refetch, isLoading };
};
