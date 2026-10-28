import { paymentProcessor } from "@/abis/PaymentProcessor";
import { SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { useConnection, useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

export const useGetMinimumInvoiceValue = () => {
  const { address } = useConnection();

  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract<bigint>({
    abi: paymentProcessor,
    chainId,
    address: SIMPLE_PAYMENT_PROCESSOR[chainId],
    functionName: "getMinimumInvoiceValue",
    account: address,
  });

  return { data, refetch, isLoading };
};
