import { paymentProcessor } from "@/abis/PaymentProcessor";
import { BASE_SEPOLIA, SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { useConnection, useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";

export const useGetInvoiceData = (invoiceId: bigint | undefined) => {
  const { address } = useConnection();

  const chainId = useChainId() || BASE_SEPOLIA;
  const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];

  const { data, refetch, isLoading } = useViemReadContract({
    abi: paymentProcessor,
    chainId,
    address: contractAddress,
    functionName: "getInvoiceData",
    args: invoiceId ? [invoiceId] : undefined,
    account: address,
    enabled: Boolean(invoiceId && contractAddress),
    queryKey: ["invoice-data", chainId, invoiceId],
  });

  return { data, refetch, isLoading };
};
