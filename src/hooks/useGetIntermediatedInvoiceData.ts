import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import { INTERMEDIATED_PAYMENT_PROCESSOR } from "@/constants";

import { useConnection, useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

export const useGetIntermediatedInvoiceData = (invoiceId: bigint | undefined) => {
  const { address } = useConnection();

  const chainId = useChainId() || BASE_SEPOLIA;
  const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];

  const { data, refetch, isLoading } = useViemReadContract({
    abi: intermediatedPaymentProcessor,
    chainId,
    address: contractAddress,
    functionName: "getInvoice",
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    account: address,
    enabled: Boolean(invoiceId !== undefined && contractAddress),
  });

  return { data, refetch, isLoading };
};
