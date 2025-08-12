import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { sepolia } from "wagmi/chains";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";

/**
 * Custom hook to retrieve the owner address of the PaymentProcessor smart contract.
 *
 * @returns  - An object containing:
 *   - `data`: The owner address returned by the smart contract.
 *   - `refetch`: A function to manually refetch the owner address.
 *   - `isLoading`: A boolean indicating whether the contract data is still being fetched.
 */
export const useGetOwner = () => {
  // Get the connected user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();
  const chainId = useChainId();

  // Use the wagmi `useReadContract` hook to interact with the `owner` function of the PaymentProcessor contract
  const { data, refetch, isLoading } = useReadContract({
    abi: PaymentProcessorStorage,
    chainId: sepolia.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "owner",
    account: address,
  });

  return { data, refetch, isLoading };
};
