import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { useAccount, useChainId } from "wagmi";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

export const useGetOwner = () => {
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract<string>({
    abi: PaymentProcessorStorage,
    chainId,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "owner",
    account: address,
  });

  return { data, refetch, isLoading };
};
