import { Address, erc20Abi } from "viem";
import { useChainId } from "wagmi";
import { BASE_SEPOLIA } from "@/constants";
import { useViemReadContract } from "./useViemReadContract";

/**
 * Custom hook to retrieve the owner address of the PaymentProcessor smart contract.
 *
 * @returns  - An object containing:
 *   - `data`: The owner address returned by the smart contract.
 *   - `refetch`: A function to manually refetch the owner address.
 *   - `isLoading`: A boolean indicating whether the contract data is still being fetched.
 */
export const useGetTokenName = (tokenAddress: Address) => {
  // The token lives on whatever chain the wallet is on; reading it from Base
  // Sepolia returns nothing for a local deployment.
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading, error } = useViemReadContract<string>({
    abi: erc20Abi,
    chainId,
    address: tokenAddress,
    functionName: "name",
  });

  return { data, refetch, isLoading, error };
};
