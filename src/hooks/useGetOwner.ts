import { SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { sepolia } from "wagmi/chains";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { paymentProcessor } from "@/abis/PaymentProcessor";

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
    abi: paymentProcessor,
    chainId: sepolia.id,
    address: SIMPLE_PAYMENT_PROCESSOR[chainId],
    functionName: "owner",
    account: address,
  });

  return { data, refetch, isLoading };
};
