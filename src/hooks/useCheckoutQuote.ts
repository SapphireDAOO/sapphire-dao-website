"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { erc20Abi, formatUnits, type Abi, type Address } from "viem";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import {
  BASE_SEPOLIA,
  DEFAULT_BLOCK_POLLING_INTERVAL_MS,
  INTERMEDIATED_PAYMENT_PROCESSOR,
  RATE_WINDOW_MS,
  ZERO_ADDRESS,
} from "@/constants";
import type { InvoiceDetails, TokenData } from "@/model/model";
import { useInvoicePaymentOptions } from "./useInvoicePaymentOptions";
import { useViemBalance } from "./useViemBalance";
import { useViemReadContract } from "./useViemReadContract";

const SIGNIFICANT_DIGITS = 5;

export const isNativeToken = (token?: TokenData) =>
  token?.id.toLowerCase() === ZERO_ADDRESS;

/** Rounds up when asked, so a shortfall is never understated. */
export const formatTokenAmount = (
  value: bigint,
  decimals: number,
  roundUp = false,
) => {
  let shown = value;
  const digits = value.toString().length;
  if (roundUp && digits > SIGNIFICANT_DIGITS) {
    const unit = BigInt(`1${"0".repeat(digits - SIGNIFICANT_DIGITS)}`);
    shown = ((value + unit - BigInt(1)) / unit) * unit;
  }
  return Number(formatUnits(shown, decimals)).toLocaleString("en-US", {
    maximumSignificantDigits: SIGNIFICANT_DIGITS,
  });
};

/** The accepted tokens, the chosen one's price for this invoice, and the wallet's balance of it. */
export const useCheckoutQuote = (
  invoice: InvoiceDetails,
  isMetaInvoice: boolean,
) => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const { address } = useAccount();

  const {
    tokens,
    isPayable,
    isLoading: isLoadingOptions,
  } = useInvoicePaymentOptions(invoice.invoiceId, isMetaInvoice);

  // ETH first: it's the one token a new wallet is sure to hold.
  const [tokenId, setTokenId] = useState<string>();
  const token =
    tokens.find((candidate) => candidate.id.toString() === tokenId) ??
    tokens.find(isNativeToken) ??
    tokens[0];
  const native = isNativeToken(token);

  const { data: amount, dataUpdatedAt: rateUpdatedAt } =
    useViemReadContract<bigint>({
      abi: intermediatedPaymentProcessor as Abi,
      address: INTERMEDIATED_PAYMENT_PROCESSOR[chainId],
      functionName: "getTokenValueFromUsd",
      args: [token?.id, BigInt(invoice.price || 0)],
      chainId,
      enabled: Boolean(token),
      staleTime: RATE_WINDOW_MS,
      refetchInterval: RATE_WINDOW_MS,
    });

  const { data: nativeBalance } = useViemBalance({
    address: native ? address : undefined,
    chainId,
  });

  const { data: tokenBalance } = useViemReadContract<bigint>({
    abi: erc20Abi,
    address: token && !native ? (token.id as Address) : undefined,
    functionName: "balanceOf",
    args: [address],
    chainId,
    enabled: Boolean(address),
    refetchInterval: DEFAULT_BLOCK_POLLING_INTERVAL_MS,
  });

  return {
    tokens,
    token,
    setTokenId,
    amount,
    rateUpdatedAt,
    balance: native ? nativeBalance : tokenBalance,
    isPayable,
    isLoadingOptions,
  };
};
