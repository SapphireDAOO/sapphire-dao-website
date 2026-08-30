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
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import { formatTokenDisplay } from "./recentTransactions";
import type {
  MetricsSocketStatus,
  RecentTransaction,
  TransactionKind,
} from "./types";

export interface RecentTransactionsSocketHandlers {
  /** A live transaction arrived; prepend it to the feed. */
  onTransaction: (tx: RecentTransaction) => void;
  /** Transport status changed; on reconnect the consumer should reseed. */
  onStatus?: (status: MetricsSocketStatus) => void;
}

export interface RecentTransactionsSocketHandle {
  close: () => void;
}

/** Minimal decoded-log shape we read from the processor ABIs. */
interface EventLog {
  eventName?: string;
  args?: Record<string, unknown>;
  transactionHash?: string;
  logIndex?: number;
}

const asBigInt = (v: unknown): bigint | undefined =>
  typeof v === "bigint" ? v : undefined;

/**
 * Open the live Recent Transactions feed for a chain. Returns a handle the
 * caller closes on unmount / chain change.
 */
export const createRecentTransactionsSocket = (
  chainId: number,
  handlers: RecentTransactionsSocketHandlers,
): RecentTransactionsSocketHandle => {
  const { onTransaction, onStatus } = handlers;
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

  const unwatchers: Array<() => void> = [];
  const handleError = () => onStatus?.("error");

  // Display nonce for a contract invoice id, read from the invoice itself.
  // Events only carry the hashed uint216 id, so each new id costs one cached
  // contract read — the polled subgraph rows show the same nonce, and the two
  // must agree for the feed to make sense.
  const nonceCache = new Map<string, string>();

  const readInvoiceNonce = (data: unknown): string => {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const value = (data as { invoiceNonce?: bigint | number }).invoiceNonce;
      if (typeof value === "bigint" || typeof value === "number") {
        return value.toString();
      }
    }
    if (Array.isArray(data)) {
      const value = data[0];
      if (typeof value === "bigint" || typeof value === "number") {
        return value.toString();
      }
    }
    return "";
  };

  const resolveInvoiceNonce = async (
    source: RecentTransaction["source"],
    invoiceId?: bigint,
  ): Promise<string> => {
    if (invoiceId === undefined) return "?";
    const key = `${source}:${invoiceId.toString()}`;
    const cached = nonceCache.get(key);
    if (cached) return cached;

    try {
      const data =
        source === "Simple"
          ? simpleAddress &&
            (await publicClient.readContract({
              address: simpleAddress,
              abi: paymentProcessor,
              functionName: "getInvoiceData",
              args: [invoiceId],
            }))
          : intermediatedAddress &&
            (await publicClient.readContract({
              address: intermediatedAddress,
              abi: intermediatedPaymentProcessor,
              functionName: "getInvoice",
              args: [invoiceId],
            }));

      const nonce = readInvoiceNonce(data);
      if (!nonce) return "?";
      nonceCache.set(key, nonce);
      return nonce;
    } catch {
      return "?";
    }
  };

  const emit = async (
    log: EventLog,
    fields: {
      kind: TransactionKind;
      source: RecentTransaction["source"];
      token: string;
      amount: bigint;
      invoiceId?: bigint;
      counterparty?: string;
    },
  ) => {
    const { amount, currency } = formatTokenDisplay(
      chainId,
      fields.token,
      fields.amount,
    );
    onTransaction({
      id: `${log.transactionHash ?? ""}-${log.logIndex ?? 0}`,
      kind: fields.kind,
      source: fields.source,
      invoiceNonce: await resolveInvoiceNonce(fields.source, fields.invoiceId),
      txHash: log.transactionHash ?? "",
      timestamp: Math.floor(Date.now() / 1000),
      amount,
      currency,
      counterparty: fields.counterparty,
    });
  };

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
                void emit(log, {
                  kind: "paid",
                  source: "Simple",
                  token: ZERO_ADDRESS,
                  amount,
                  invoiceId: asBigInt(a.invoiceId),
                  counterparty: a.buyer as string | undefined,
                });
                break;
              }
              case "InvoiceRefunded": {
                const amount = asBigInt(a.amount);
                if (amount === undefined) break;
                void emit(log, {
                  kind: "refunded",
                  source: "Simple",
                  token: ZERO_ADDRESS,
                  amount,
                  invoiceId: asBigInt(a.invoiceId),
                });
                break;
              }
              case "InvoiceReleased": {
                const sellerAmount = asBigInt(a.sellerAmount);
                const fee = asBigInt(a.fee);
                if (sellerAmount === undefined || fee === undefined) break;
                void emit(log, {
                  kind: "released",
                  source: "Simple",
                  token: ZERO_ADDRESS,
                  amount: sellerAmount + fee,
                  invoiceId: asBigInt(a.invoiceId),
                });
                break;
              }
            }
          }
        },
      }),
    );
  }

  if (intermediatedAddress) {
    const tokenByInvoice = new Map<string, Address>();
    unwatchers.push(
      publicClient.watchContractEvent({
        address: intermediatedAddress,
        abi: intermediatedPaymentProcessor,
        onError: handleError,
        onLogs: (logs) => {
          for (const log of logs as unknown as EventLog[]) {
            const a = log.args ?? {};
            const invoiceId = asBigInt(a.invoiceId)?.toString();
            const cachedToken = invoiceId
              ? tokenByInvoice.get(invoiceId)
              : undefined;
            switch (log.eventName) {
              case "InvoicePaid": {
                const token = a.paymentToken as Address | undefined;
                const amount = asBigInt(a.amount);
                if (!token || amount === undefined) break;
                if (invoiceId) tokenByInvoice.set(invoiceId, token);
                void emit(log, {
                  kind: "paid",
                  source: "Intermediated",
                  token,
                  amount,
                  invoiceId: asBigInt(a.invoiceId),
                });
                break;
              }
              case "PaymentReleased": {
                const token = a.currency as Address | undefined;
                const sellerAmount = asBigInt(a.sellerAmount);
                if (!token || sellerAmount === undefined) break;
                void emit(log, {
                  kind: "released",
                  source: "Intermediated",
                  token,
                  amount: sellerAmount,
                  invoiceId: asBigInt(a.invoiceId),
                  counterparty: a.receiver as string | undefined,
                });
                break;
              }
              case "Refunded": {
                const amount = asBigInt(a.amount);
                if (amount === undefined || !cachedToken) break;
                void emit(log, {
                  kind: "refunded",
                  source: "Intermediated",
                  token: cachedToken,
                  amount,
                  invoiceId: asBigInt(a.invoiceId),
                });
                break;
              }
              case "DisputeSettled": {
                const sellerAmount = asBigInt(a.sellerAmount);
                const buyerAmount = asBigInt(a.buyerAmount);
                if (
                  sellerAmount === undefined ||
                  buyerAmount === undefined ||
                  !cachedToken
                )
                  break;
                void emit(log, {
                  kind: "settled",
                  source: "Intermediated",
                  token: cachedToken,
                  amount: sellerAmount + buyerAmount,
                  invoiceId: asBigInt(a.invoiceId),
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
