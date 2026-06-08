import type { Address } from "viem";
import { getPublicClient } from "wagmi/actions";
import config from "@/config";
import {
  SIMPLE_PAYMENT_PROCESSOR,
  ADVANCED_PAYMENT_PROCESSOR,
  PAYMENT_PROCESSOR_STORAGE,
  ZERO_ADDRESS,
  BASE_SEPOLIA,
  LOCALHOST,
} from "@/constants";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
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
  const advancedAddress = ADVANCED_PAYMENT_PROCESSOR[chainId];

  if (!publicClient || (!simpleAddress && !advancedAddress)) {
    onStatus?.("closed");
    return { close: () => {} };
  }

  const storageAddress = PAYMENT_PROCESSOR_STORAGE[chainId];
  const unwatchers: Array<() => void> = [];
  const handleError = () => onStatus?.("error");

  let idChain: Promise<bigint> = (async () => {
    if (!storageAddress) return BigInt(0);
    try {
      let next = (await publicClient.readContract({
        address: storageAddress,
        abi: PaymentProcessorStorage,
        functionName: "getNextInvoiceNonce",
      })) as bigint;
      next = next + BigInt(1)
      return next > BigInt(0) ? next - BigInt(1) : next;
    } catch {
      return BigInt(0);
    }
  })();

  const claimInvoiceNonce = async (): Promise<string> => {
    const claimed = idChain; 
    idChain = idChain.then((v) => v + BigInt(1));
    const v_1 = await claimed;
    return v_1.toString();
  };

  const emit = async (
    log: EventLog,
    fields: {
      kind: TransactionKind;
      source: RecentTransaction["source"];
      token: string;
      amount: bigint;
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
      invoiceNonce: await claimInvoiceNonce(),
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
                });
                break;
              }
            }
          }
        },
      }),
    );
  }

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
                  source: "Marketplace",
                  token,
                  amount,
                });
                break;
              }
              case "PaymentReleased": {
                const token = a.currency as Address | undefined;
                const sellerAmount = asBigInt(a.sellerAmount);
                if (!token || sellerAmount === undefined) break;
                void emit(log, {
                  kind: "released",
                  source: "Marketplace",
                  token,
                  amount: sellerAmount,
                  counterparty: a.receiver as string | undefined,
                });
                break;
              }
              case "Refunded": {
                const amount = asBigInt(a.amount);
                if (amount === undefined || !cachedToken) break;
                void emit(log, {
                  kind: "refunded",
                  source: "Marketplace",
                  token: cachedToken,
                  amount,
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
                  source: "Marketplace",
                  token: cachedToken,
                  amount: sellerAmount + buyerAmount,
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
