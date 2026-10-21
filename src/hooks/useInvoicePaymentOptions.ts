"use client";

import { useQuery } from "@tanstack/react-query";
import { useChainId, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import {
  BASE_SEPOLIA,
  INTERMEDIATED_PAYMENT_PROCESSOR,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import type { TokenData } from "@/model/model";
import {
  fetchRegisteredPaymentTokens,
  fetchTokenData,
} from "@/services/invoicePaymentTokens";

/** `CREATED` in Intermediated.sol, the only payable state. */
const STATE_CREATED = 1;

export const useInvoicePaymentOptions = (
  invoiceId: bigint | undefined,
  isMetaInvoice: boolean,
) => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });
  const address = INTERMEDIATED_PAYMENT_PROCESSOR[chainId] as
    | Address
    | undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "invoice-payment-options",
      chainId,
      invoiceId?.toString(),
      isMetaInvoice,
    ],
    enabled: Boolean(publicClient && address && invoiceId),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    queryFn: async () => {
      if (!publicClient || !address || !invoiceId) {
        return { tokens: [] as TokenData[], isPayable: false };
      }

      const shared = { address, abi: intermediatedPaymentProcessor } as const;

      const invoiceIds: bigint[] = isMetaInvoice
        ? [
            ...((
              await publicClient.readContract({
                ...shared,
                functionName: "getMetaInvoice",
                args: [invoiceId],
              })
            )?.subInvoiceIds ?? []),
          ]
        : [invoiceId];

      if (invoiceIds.length === 0) {
        return { tokens: [] as TokenData[], isPayable: false };
      }

      const states = (await publicClient.multicall({
        allowFailure: false,
        contracts: invoiceIds.map((id) => ({
          ...shared,
          functionName: "getInvoice",
          args: [id],
        })),
      })) as unknown as { state: number | bigint }[];

      const isPayable = states.every(
        (invoice) => Number(invoice?.state) === STATE_CREATED,
      );

      const candidateIds = await fetchRegisteredPaymentTokens(
        publicClient,
        chainId,
        address,
        invoiceId,
        isMetaInvoice,
      );

      // Rechecked live, in case the contract has since stopped accepting one.
      const allowances = (await publicClient.multicall({
        allowFailure: false,
        contracts: invoiceIds.flatMap((id) =>
          candidateIds.map((token) => ({
            ...shared,
            functionName: "isPaymentTokenAllowed",
            args: [id, token],
          })),
        ),
      })) as unknown as boolean[];

      const allowed = candidateIds.filter((_, tokenIndex) =>
        invoiceIds.every(
          (_id, idIndex) =>
            allowances[idIndex * candidateIds.length + tokenIndex] === true,
        ),
      );

      return {
        tokens: await fetchTokenData(publicClient, allowed),
        isPayable,
      };
    },
  });

  return {
    tokens: data?.tokens ?? [],
    isPayable: data?.isPayable ?? false,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
};
