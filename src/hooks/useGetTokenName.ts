import { Address, erc20Abi } from "viem";
import { useChainId } from "wagmi";
import { BASE_SEPOLIA } from "@/constants";
import { useViemReadContract } from "./useViemReadContract";

export const useGetTokenName = (tokenAddress: Address) => {
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading, error } = useViemReadContract<string>({
    abi: erc20Abi,
    chainId,
    address: tokenAddress,
    functionName: "name",
  });

  return { data, refetch, isLoading, error };
};
