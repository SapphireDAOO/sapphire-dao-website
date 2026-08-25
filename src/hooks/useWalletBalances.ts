"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { formatEther, type Address } from "viem";

import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
  PAYMENT_PROCESSOR_STORAGE,
} from "@/constants";

import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import {
  fetchFeeReceiverTotalUsd,
  fetchNativePriceUsd,
} from "@/services/metrics/subgraphMetrics";

import {
  formatUsd,
  METRIC_PLACEHOLDER,
} from "@/components/action-components/metrics/formatMetric";

import { useViemReadContract } from "./useViemReadContract";
import { useViemBalance } from "./useViemBalance";

/** A single row in the Wallet & Contract Balances card. */
export interface WalletBalanceItem {
  name: string;
  address?: Address;
  primary: string;
  secondary: string;
  isLoading: boolean;
}

const formatEth = (wei: bigint): string =>
  `${Number(formatEther(wei)).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} ETH`;

export const useWalletBalances = () => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;
  const storage = PAYMENT_PROCESSOR_STORAGE[chainId];

  /**
   * -------------------------
   * Contract reads (batched conceptually)
   * -------------------------
   */
  const { data: feeReceiver, isLoading: loadingFeeReceiver } =
    useViemReadContract<Address>({
      abi: PaymentProcessorStorage,
      chainId,
      address: storage,
      functionName: "getFeeReceiver",
    });

  const { data: gasWallet, isLoading: loadingGasWallet } =
    useViemReadContract<Address>({
      abi: PaymentProcessorStorage,
      chainId,
      address: storage,
      functionName: "getIntermediatedPlatformsOperator",
    });

  const {
    data: gasWei,
    isLoading: loadingGasBalance,
    refetch: refetchGasBalance,
  } = useViemBalance({
    address: gasWallet,
    chainId,
    watchBlock: false,
  });

  const {
    data: feeTotalUsd,
    isLoading: loadingFees,
    refetch: refetchFees,
  } = useQuery({
    queryKey: ["fee-receiver-total-usd", chainId, storage],
    queryFn: () => fetchFeeReceiverTotalUsd(chainId),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  const {
    data: nativePrice,
    isLoading: loadingPrice,
    refetch: refetchPrice,
  } = useQuery({
    queryKey: ["native-price-usd", chainId],
    queryFn: () => fetchNativePriceUsd(chainId),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  /**
   * -------------------------
   * Derived values (memoized)
   * -------------------------
   */
  const gasEth = useMemo(() => {
    if (!gasWei) return undefined;
    return formatEth(gasWei);
  }, [gasWei]);

  const gasUsd = useMemo(() => {
    if (gasWei === undefined || nativePrice === undefined) return undefined;
    return Number(formatEther(gasWei)) * nativePrice;
  }, [gasWei, nativePrice]);

  /**
   * -------------------------
   * UI items (fully stable)
   * -------------------------
   */
  const items: WalletBalanceItem[] = useMemo(
    () => [
      {
        name: "Fee Receiver",
        address: feeReceiver,
        primary:
          feeTotalUsd !== undefined
            ? formatUsd(feeTotalUsd)
            : METRIC_PLACEHOLDER,
        secondary: "Fees collected",
        isLoading: loadingFeeReceiver || loadingFees,
      },
      {
        name: "Gas Reserve",
        address: gasWallet,
        primary: gasEth ?? METRIC_PLACEHOLDER,
        secondary:
          gasUsd !== undefined ? formatUsd(gasUsd) : METRIC_PLACEHOLDER,
        isLoading: loadingGasWallet || loadingGasBalance || loadingPrice,
      },
    ],
    [
      feeReceiver,
      feeTotalUsd,
      gasWallet,
      gasEth,
      gasUsd,
      loadingFeeReceiver,
      loadingFees,
      loadingGasWallet,
      loadingGasBalance,
      loadingPrice,
    ],
  );

  /**
   * -------------------------
   * Refetch (fixed completeness)
   * -------------------------
   */
  const refetch = () => {
    void refetchFees();
    void refetchGasBalance();
    void refetchPrice();
  };

  return { items, refetch };
};
