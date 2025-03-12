import { INVOICE_ADDRESS } from "@/constants";
import { PaymentProcessor__factory } from "@/typechain";
import { polygonAmoy } from "wagmi/chains";
import { useAccount, useChainId, useReadContract } from "wagmi";

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
    abi: PaymentProcessor__factory.abi,
    chainId: polygonAmoy.id,
    address: INVOICE_ADDRESS[chainId],
    functionName: "owner",
    account: address,
  });

  return { data, refetch, isLoading };
};
