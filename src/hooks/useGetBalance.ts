import { BASE_SEPOLIA, PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { useAccount, useChainId } from "wagmi";
import { Address, formatEther } from "viem";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";
import { useViemBalance } from "./useViemBalance";

export const useGetBalance = () => {
  const { address } = useAccount();

  const chainId = useChainId() || BASE_SEPOLIA;

  const {
    data: intermediatedOperatorAddress,
    isLoading: isLoadingAddress,
    refetch: refetchAddress,
  } = useViemReadContract({
    abi: PaymentProcessorStorage,
    chainId,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getIntermediatedPlatformsOperator",
    account: address,
  });

  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useViemBalance({
    address: intermediatedOperatorAddress as Address | undefined,
    chainId,
  });

  const formattedBalance = balanceData ? formatEther(balanceData) : undefined;

  const refetch = async () => {
    await Promise.all([refetchAddress(), refetchBalance()]);
  };

  return {
    data: formattedBalance,
    refetch,
    isLoading: isLoadingAddress || isLoadingBalance,
  };
};
