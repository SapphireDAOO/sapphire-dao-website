import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";

import { useChainId } from "wagmi";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

export const useGetFeeRate = () => {
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract({
    abi: PaymentProcessorStorage,
    chainId,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getFeeRate",
  });

  return { data, refetch, isLoading };
};
