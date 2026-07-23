import type { Address } from "viem";
import { getPublicClient } from "wagmi/actions";
import config from "@/config";
import {
  SIMPLE_PAYMENT_PROCESSOR,
  ADVANCED_PAYMENT_PROCESSOR,
  ZERO_ADDRESS,
  BASE_SEPOLIA,
  LOCALHOST,
} from "@/constants";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { createUsdConverter } from "./subgraphMetrics";
import type { MetricsDelta, MetricsSocketStatus } from "./types";

export interface MetricsSocketHandlers {
  /** A live delta arrived; apply it optimistically over the current values. */
  onDelta: (delta: MetricsDelta) => void;
  /** Transport status changed; on reconnect the consumer should reseed. */
  onStatus?: (status: MetricsSocketStatus) => void;
}

export interface MetricsSocketHandle {
  /** Tear down the subscriptions and underlying transport. */
  close: () => void;
}

/** Minimal decoded-log shape we read from the processor ABIs. */
interface EventLog {
  eventName?: string;
  args?: Record<string, unknown>;
}

const asBigInt = (v: unknown): bigint | undefined =>
  typeof v === "bigint" ? v : undefined;

/**
 * Open the live metric feed for a chain: subscribe to both processors' events
 * and route USD deltas to the handlers. Returns a handle the caller closes on
 * unmount / chain change. Emits "connecting" → "open" once subscribed, "error"
 * on a transport error, and "closed" when there is nothing to subscribe to.
 */
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
  const advancedAddress = ADVANCED_PAYMENT_PROCESSOR[chainId];

  if (!publicClient || (!simpleAddress && !advancedAddress)) {
    onStatus?.("closed");
    return { close: () => {} };
  }

  const toUsd = createUsdConverter(chainId);
  const unwatchers: Array<() => void> = [];
  const handleError = () => onStatus?.("error");

  // Simple processor is native-only → token is always the zero address.
  if (simpleAddress) {
    unwatchers.push(
      publicClient.watchContractEvent({
        address: simpleAddress,
        abi: paymentProcessor,
        onError: handleError,
        onLogs: (logs) => {
          for (const log of logs as unknown as EventLog[]) {
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
      }),
    );
  }

  // Advanced refund / dispute events carry no token, so cache each invoice's
  // token from its InvoicePaid for the rest of the session.
  if (advancedAddress) {
    const tokenByInvoice = new Map<string, Address>();
    unwatchers.push(
      publicClient.watchContractEvent({
        address: advancedAddress,
        abi: advancedPaymentProcessor,
        onError: handleError,
        onLogs: (logs) => {
          for (const log of logs as unknown as EventLog[]) {
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
                  activityMarketplace: 1,
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
                  activityMarketplace: 1,
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
                  activityMarketplace: 1,
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
                  activityMarketplace: 1,
                });
                break;
              }
            }
          }
        },
      }),
    );
  }

  onStatus?.("open");

  return {
    close: () => {
      for (const unwatch of unwatchers) unwatch();
    },
  };
};
