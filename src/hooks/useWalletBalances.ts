"use client";

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
  /** Human label for the wallet/contract. */
  name: string;
  /** Resolved on-chain address; undefined while the storage read is pending. */
  address?: Address;
  /** Primary figure, e.g. "$48,200" or "0.85 ETH". */
  primary: string;
  /** Secondary line under the primary figure. */
  secondary: string;
  isLoading: boolean;
}

const formatEth = (wei: bigint): string =>
  `${Number(formatEther(wei)).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} ETH`;

/**
 * Backs the metrics page's Wallet & Contract Balances card, per the
 * first-section-metrics spec:
 *   - Fee Receiver: lifetime fees collected (subgraph) converted to USD.
 *   - Gas Reserve: native balance of the platform wallet via eth_getBalance.
 * Addresses come from the PaymentProcessorStorage contract.
 */
export const useWalletBalances = () => {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;
  const storage = PAYMENT_PROCESSOR_STORAGE[chainId];

  const { data: feeReceiver, isLoading: loadingFeeReceiver } =
    useViemReadContract<Address>({
      abi: PaymentProcessorStorage,
      chainId,
      address: storage,
      functionName: "getFeeReceiver",
    });

  // The platform (marketplace) wallet is the gas-spending wallet.
  const { data: gasWallet, isLoading: loadingGasWallet } =
    useViemReadContract<Address>({
      abi: PaymentProcessorStorage,
      chainId,
      address: storage,
      functionName: "getMarketplace",
    });

  const {
    data: gasWei,
    isLoading: loadingGasBalance,
    refetch: refetchGasBalance,
  } = useViemBalance({ address: gasWallet, chainId });

  const {
    data: feeTotalUsd,
    isLoading: loadingFees,
    refetch: refetchFees,
  } = useQuery({
    queryKey: ["fee-receiver-total-usd", chainId],
    queryFn: () => fetchFeeReceiverTotalUsd(chainId),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  const { data: nativePrice } = useQuery({
    queryKey: ["native-price-usd", chainId],
    queryFn: () => fetchNativePriceUsd(chainId),
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  const gasUsd =
    gasWei !== undefined && nativePrice !== undefined
      ? Number(formatEther(gasWei)) * nativePrice
      : undefined;

  const items: WalletBalanceItem[] = [
    {
      name: "Fee Receiver",
      address: feeReceiver,
      primary:
        feeTotalUsd !== undefined ? formatUsd(feeTotalUsd) : METRIC_PLACEHOLDER,
      secondary: "Fees collected",
      isLoading: loadingFeeReceiver || loadingFees,
    },
    {
      name: "Gas Reserve",
      address: gasWallet,
      primary: gasWei !== undefined ? formatEth(gasWei) : METRIC_PLACEHOLDER,
      secondary: gasUsd !== undefined ? formatUsd(gasUsd) : METRIC_PLACEHOLDER,
      isLoading: loadingGasWallet || loadingGasBalance,
    },
  ];

  const refetch = () => {
    void refetchFees();
    void refetchGasBalance();
  };

  return { items, refetch };
};
