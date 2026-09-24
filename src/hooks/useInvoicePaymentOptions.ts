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

/** `CREATED` in constants/Intermediated.sol — the only state that can be paid. */
const STATE_CREATED = 1;

export const useInvoicePaymentOptions = (
  invoiceId: bigint | undefined,
  isMetaInvoice: boolean,
  candidates: TokenData[],
) => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });
  const address = INTERMEDIATED_PAYMENT_PROCESSOR[chainId] as
    | Address
    | undefined;

  const candidateIds = candidates.map((token) => token.id.toString());

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "invoice-payment-options",
      chainId,
      invoiceId?.toString(),
      isMetaInvoice,
      candidateIds.join(","),
    ],
    enabled: Boolean(publicClient && address && invoiceId && candidates.length),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    queryFn: async () => {
      if (!publicClient || !address || !invoiceId) {
        return { allowed: [] as string[], isPayable: false };
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

      // A meta-invoice with no sub-invoices cannot be paid, and treating an
      // empty set as "every member qualifies" would say the opposite.
      if (invoiceIds.length === 0) {
        return { allowed: [] as string[], isPayable: false };
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

      const allowances = (await publicClient.multicall({
        allowFailure: false,
        contracts: invoiceIds.flatMap((id) =>
          candidateIds.map((token) => ({
            ...shared,
            functionName: "isPaymentTokenAllowed",
            args: [id, token as Address],
          })),
        ),
      })) as unknown as boolean[];

      const allowed = candidateIds.filter((_, tokenIndex) =>
        invoiceIds.every(
          (_id, idIndex) =>
            allowances[idIndex * candidateIds.length + tokenIndex] === true,
        ),
      );

      return { allowed, isPayable };
    },
  });

  const allowedIds = new Set(data?.allowed ?? []);

  return {
    /** The candidates this invoice accepts, in the order they were given. */
    tokens: candidates.filter((token) => allowedIds.has(token.id.toString())),
    /** False until the reads land, so the pay button cannot be jumped on. */
    isPayable: data?.isPayable ?? false,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
};
