import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import { INTERMEDIATED_PAYMENT_PROCESSOR } from "@/constants";

import { useConnection, useChainId } from "wagmi";
import { useViemReadContract } from "./useViemReadContract";
import { BASE_SEPOLIA } from "@/constants";

export const useGetMetaInvoice = (invoiceId: bigint) => {
  const { address } = useConnection();

  const chainId = useChainId() || BASE_SEPOLIA;

  const { data, refetch, isLoading } = useViemReadContract({
    abi: intermediatedPaymentProcessor,
    chainId,
    address: INTERMEDIATED_PAYMENT_PROCESSOR[chainId],
    functionName: "getMetaInvoice",
    args: [invoiceId],
    account: address,
  });

  return { data, refetch, isLoading };
};
