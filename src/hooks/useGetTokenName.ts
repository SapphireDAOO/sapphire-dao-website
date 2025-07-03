import { sepolia } from "wagmi/chains";
import { useReadContract } from "wagmi";
import { Address, erc20Abi } from "viem";

/**
 * Custom hook to retrieve the owner address of the PaymentProcessor smart contract.
 *
 * @returns  - An object containing:
 *   - `data`: The owner address returned by the smart contract.
 *   - `refetch`: A function to manually refetch the owner address.
 *   - `isLoading`: A boolean indicating whether the contract data is still being fetched.
 */
export const useGetTokenName = (tokenAddress: Address) => {
  const { data, refetch, isLoading, error } = useReadContract({
    abi: erc20Abi,
    chainId: sepolia.id,
    address: tokenAddress,
    functionName: "name",
  });

  return { data, refetch, isLoading, error };
};
