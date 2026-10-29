import { paymentProcessor } from "@/abis/PaymentProcessor";
import { BASE_SEPOLIA, ONE_DAY_MS, SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";

// The simple processor fixes one hold period for every invoice at deployment.
export const useEscrowHoldPeriod = () => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];

  const { data, isLoading } = useViemReadContract<number>({
    abi: paymentProcessor,
    chainId,
    address: contractAddress,
    functionName: "ESCROW_HOLD_PERIOD",
    enabled: Boolean(contractAddress),
    queryKey: ["escrow-hold-period", chainId, contractAddress],
    select: (value) => Number(value),
    staleTime: ONE_DAY_MS,
  });

  return { data, isLoading };
};
