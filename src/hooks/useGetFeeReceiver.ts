import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { ETHEREUM_SEPOLIA, PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { sepolia } from "viem/chains";
import { useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";

/**
 * Custom hook to retrieve the fee receiver address from the PaymentProcessor smart contract.
 *
 * @returns - An object containing:
 *   - `data`: The fee receiver's address returned by the smart contract.
 *   - `refetch`: A function to manually refetch the fee receiver address.
 *   - `isLoading`: A boolean indicating whether the contract data is still being fetched.
 */
export const useGetFeeReceiver = () => {
  // Get the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId() || ETHEREUM_SEPOLIA;

  // Use the wagmi `useReadContract` hook to interact with the `getFeeReceiver` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useViemReadContract<string>({
    abi: PaymentProcessorStorage,
    chainId: sepolia.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getFeeReceiver",
  });

  return { data, refetch, isLoading };
};
