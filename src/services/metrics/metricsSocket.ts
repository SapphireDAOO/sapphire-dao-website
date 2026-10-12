import type { Address } from "viem";
import { getPublicClient } from "wagmi/actions";
import config from "@/config";
import {
  SIMPLE_PAYMENT_PROCESSOR,
  INTERMEDIATED_PAYMENT_PROCESSOR,
  ZERO_ADDRESS,
  BASE_SEPOLIA,
  LOCALHOST,
} from "@/constants";
import { createUsdConverter } from "./subgraphMetrics";
import { subscribeProcessorLogs } from "./processorLogs";
import type { MetricsDelta, MetricsSocketStatus } from "./types";

export interface MetricsSocketHandlers {
  onDelta: (delta: MetricsDelta) => void;
  onStatus?: (status: MetricsSocketStatus) => void;
}

export interface MetricsSocketHandle {
  close: () => void;
}

const asBigInt = (v: unknown): bigint | undefined =>
  typeof v === "bigint" ? v : undefined;

export const createMetricsSocket = (
  chainId: number,
  handlers: MetricsSocketHandlers,
): MetricsSocketHandle => {
  const { onDelta, onStatus } = handlers;
  onStatus?.("connecting");

  const publicClient = getPublicClient(config, {
    chainId: chainId as typeof BASE_SEPOLIA | typeof LOCALHOST,
  });
  const simpleAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
  const intermediatedAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];

  if (!publicClient || (!simpleAddress && !intermediatedAddress)) {
    onStatus?.("closed");
    return { close: () => {} };
  }

  const toUsd = createUsdConverter(chainId);
  const unwatchers: Array<() => void> = [];
  const handleError = () => onStatus?.("error");

  if (simpleAddress) {
    const unsubscribe = subscribeProcessorLogs(chainId, "Simple", {
      onError: handleError,
      onLogs: (logs) => {
        for (const log of logs) {
          const a = log.args ?? {};
          switch (log.eventName) {
            case "InvoicePaid": {
              const amount = asBigInt(a.amountPaid);
              if (amount === undefined) break;
              const usd = toUsd(ZERO_ADDRESS, amount);
              onDelta({
                volumeUsd: usd,
                escrowUsd: usd,
                escrowPaidUsd: usd,
                invoicesPaid: 1,
                activityWebsite: 1,
              });
              break;
            }
            case "InvoiceReleased": {
              const sellerAmount = asBigInt(a.sellerAmount);
              const fee = asBigInt(a.fee);
              if (sellerAmount === undefined || fee === undefined) break;
              onDelta({
                escrowUsd: -toUsd(ZERO_ADDRESS, sellerAmount + fee),
                feesUsd: toUsd(ZERO_ADDRESS, fee),
                activityWebsite: 1,
              });
              break;
            }
            case "InvoiceRefunded":
            case "InvoiceRejected":
            case "LockedPaymentRecovered": {
              const amount = asBigInt(a.amount);
              onDelta({
                escrowUsd:
                  amount === undefined
                    ? undefined
                    : -toUsd(ZERO_ADDRESS, amount),
                activityWebsite: 1,
              });
              break;
            }
          }
        }
      },
    });
    if (unsubscribe) unwatchers.push(unsubscribe);
  }

  // Intermediated refund/dispute events carry no token,
  // so each invoice's is remembered from InvoicePaid.
  if (intermediatedAddress) {
    const tokenByInvoice = new Map<string, Address>();
    const unsubscribe = subscribeProcessorLogs(chainId, "Intermediated", {
      onError: handleError,
      onLogs: (logs) => {
        for (const log of logs) {
          const a = log.args ?? {};
          const invoiceId = asBigInt(a.invoiceId)?.toString();
          switch (log.eventName) {
            case "InvoicePaid": {
              const token = a.paymentToken as Address | undefined;
              const amount = asBigInt(a.amount);
              if (!token || amount === undefined) break;
              if (invoiceId) tokenByInvoice.set(invoiceId, token);
              const usd = toUsd(token, amount);
              onDelta({
                volumeUsd: usd,
                escrowUsd: usd,
                escrowPaidUsd: usd,
                invoicesPaid: 1,
                activityIntermediated: 1,
              });
              break;
            }
            case "PaymentReleased": {
              const token = a.currency as Address | undefined;
              const sellerAmount = asBigInt(a.sellerAmount);
              const fee = asBigInt(a.fee);
              if (!token || sellerAmount === undefined || fee === undefined)
                break;
              onDelta({
                escrowUsd: -toUsd(token, sellerAmount + fee),
                feesUsd: toUsd(token, fee),
                activityIntermediated: 1,
              });
              break;
            }
            case "Refunded": {
              const amount = asBigInt(a.amount);
              const token = invoiceId
                ? tokenByInvoice.get(invoiceId)
                : undefined;
              onDelta({
                escrowUsd:
                  token && amount !== undefined
                    ? -toUsd(token, amount)
                    : undefined,
                activityIntermediated: 1,
              });
              break;
            }
            case "DisputeSettled": {
              const sellerAmount = asBigInt(a.sellerAmount);
              const buyerAmount = asBigInt(a.buyerAmount);
              const fee = asBigInt(a.fee);
              const token = invoiceId
                ? tokenByInvoice.get(invoiceId)
                : undefined;
              const haveAmounts =
                sellerAmount !== undefined &&
                buyerAmount !== undefined &&
                fee !== undefined;
              onDelta({
                escrowUsd:
                  token && haveAmounts
                    ? -toUsd(token, sellerAmount + buyerAmount + fee)
                    : undefined,
                feesUsd:
                  token && fee !== undefined ? toUsd(token, fee) : undefined,
                activityIntermediated: 1,
              });
              break;
            }
          }
        }
      },
    });
    if (unsubscribe) unwatchers.push(unsubscribe);
  }

  onStatus?.("open");

  return {
    close: () => {
      for (const unwatch of unwatchers) unwatch();
    },
  };
};
