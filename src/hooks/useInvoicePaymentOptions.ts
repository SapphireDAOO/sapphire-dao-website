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
  const shared = address
    ? ({ address, abi: intermediatedPaymentProcessor } as const)
    : undefined;
  const id = invoiceId?.toString();

  // Fixed when the invoice was created, so fetched once and never refetched.
  const terms = useQuery({
    queryKey: ["invoice-payment-terms", chainId, id, isMetaInvoice],
    enabled: Boolean(publicClient && shared && invoiceId),
    staleTime: Infinity,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    queryFn: async () => {
      if (!publicClient || !shared || !invoiceId || !address) {
        return { invoiceIds: [] as bigint[], tokens: [] as TokenData[] };
      }

      const [invoiceIds, registered] = await Promise.all([
        isMetaInvoice
          ? publicClient
              .readContract({
                ...shared,
                functionName: "getMetaInvoice",
                args: [invoiceId],
              })
              .then((meta) => [...(meta?.subInvoiceIds ?? [])])
          : Promise.resolve([invoiceId]),
        fetchRegisteredPaymentTokens(
          publicClient,
          chainId,
          address,
          invoiceId,
          isMetaInvoice,
        ),
      ]);

      return {
        invoiceIds,
        tokens: await fetchTokenData(publicClient, registered),
      };
    },
  });

  const invoiceIds = terms.data?.invoiceIds ?? [];
  const candidates = terms.data?.tokens ?? [];

  // State and allowances in one request: the only part that can change.
  const live = useQuery({
    queryKey: [
      "invoice-payment-options",
      chainId,
      id,
      isMetaInvoice,
      candidates.map((token) => token.id).join(","),
    ],
    enabled: Boolean(publicClient && shared && invoiceIds.length),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
    queryFn: async () => {
      if (!publicClient || !shared) {
        return { allowed: [] as string[], isPayable: false };
      }

      const results = (await publicClient.multicall({
        allowFailure: false,
        contracts: [
          ...invoiceIds.map((invoice) => ({
            ...shared,
            functionName: "getInvoice" as const,
            args: [invoice] as const,
          })),
          ...invoiceIds.flatMap((invoice) =>
            candidates.map((token) => ({
              ...shared,
              functionName: "isPaymentTokenAllowed" as const,
              args: [invoice, token.id as Address] as const,
            })),
          ),
        ],
      })) as unknown[];

      const states = results.slice(0, invoiceIds.length) as {
        state: number | bigint;
      }[];
      const allowances = results.slice(invoiceIds.length) as boolean[];

      return {
        isPayable: states.every(
          (invoice) => Number(invoice?.state) === STATE_CREATED,
        ),
        // Rechecked live, in case the contract has since stopped accepting one.
        allowed: candidates
          .filter((_, tokenIndex) =>
            invoiceIds.every(
              (_invoice, idIndex) =>
                allowances[idIndex * candidates.length + tokenIndex] === true,
            ),
          )
          .map((token) => token.id),
      };
    },
  });

  const allowed = new Set(live.data?.allowed ?? []);
  const error = terms.error ?? live.error;

  return {
    tokens: candidates.filter((token) => allowed.has(token.id)),
    isPayable: live.data?.isPayable ?? false,
    // A meta invoice with no sub-invoices never runs the live check.
    isLoading: terms.isLoading || (invoiceIds.length > 0 && live.isPending),
    error: error instanceof Error ? error.message : null,
  };
};
