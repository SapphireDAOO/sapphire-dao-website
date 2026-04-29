/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { type AbiEvent } from "viem";
import type { PublicClient } from "viem";
import { ADVANCED_PAYMENT_PROCESSOR } from "@/constants";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { appendHistoryEntry, nowInSeconds } from "@/lib/invoiceHistory";
import {
  getInvoiceMergeKey,
  matchesInvoiceIdentity,
} from "@/lib/invoiceIdentifiers";
import { unixToGMT } from "@/utils";
import type { Invoice } from "@/model/model";

interface Params {
  active: boolean;
  address: string | undefined;
  chainId: number;
  publicClient: PublicClient | undefined;
  setInvoiceData: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onLiveInvoices?: (invoices: Invoice[]) => void;
  hydrateMarketplaceInvoiceFromChain?: (
    invoiceId: bigint,
    status?: Invoice["status"],
    txHash?: string,
    eventFields?: Partial<Invoice>,
  ) => void | Promise<void>;
}

const findMarketplaceInvoice = (
  invoices: Iterable<Invoice>,
  invoiceId: string,
) => {
  for (const invoice of invoices) {
    if (matchesInvoiceIdentity(invoice, invoiceId, "Marketplace")) {
      return invoice;
    }
  }

  return undefined;
};

export function useMarketplaceInvoiceEvents({
  active,
  address,
  chainId,
  publicClient,
  setInvoiceData,
  onLiveInvoices,
  hydrateMarketplaceInvoiceFromChain,
}: Params) {
  useEffect(() => {
    if (!active || !publicClient || !address) return;
    const contractAddress = ADVANCED_PAYMENT_PROCESSOR[chainId];
    if (!contractAddress) return;

    const statusFromEvent: Record<string, Invoice["status"]> = {
      InvoicePaid: "PAID",
      InvoiceCanceled: "CANCELED",
      PaymentReleased: "RELEASED",
      Refunded: "REFUNDED",
      DisputeCreated: "DISPUTED",
      DisputeResolved: "DISPUTE_RESOLVED",
      DisputeDismissed: "DISPUTE_DISMISSED",
      DisputeSettled: "DISPUTE_SETTLED",
      InvoiceCreated: "AWAITING PAYMENT",
    };

    const marketEvents = (
      advancedPaymentProcessor as readonly { type: string }[]
    ).filter((item): item is AbiEvent => item.type === "event");

    const toRawString = (value?: bigint | number | string | null) => {
      if (value === undefined || value === null) return undefined;
      return value.toString();
    };

    const addSeconds = (
      baseSeconds: string,
      duration?: bigint | number | string | null,
    ) => {
      if (duration === undefined || duration === null) return undefined;
      try {
        return (BigInt(baseSeconds) + BigInt(duration.toString())).toString();
      } catch {
        return undefined;
      }
    };

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: marketEvents,
      onLogs: (logs) => {
        const batchTime = nowInSeconds();
        setInvoiceData((prev) => {
          const liveInvoices: Invoice[] = [];
          const updatedMap = new Map<string, Invoice>(
            prev.map((inv) => [getInvoiceMergeKey(inv), inv]),
          );

          for (const log of logs) {
            const name = log.eventName ?? "";
            const logArgs = log.args as
              | {
                  invoiceId?: bigint;
                  invoiceNonce?: bigint;
                  amount?: bigint;
                  paymentToken?: string;
                  currency?: string;
                  sellerAmount?: bigint;
                  buyerAmount?: bigint;
                  newHoldPeriod?: bigint;
                  releaseAt?: bigint;
                }
              | undefined;
            const invoiceId = (logArgs?.invoiceId ?? logArgs?.invoiceNonce)?.toString();

            if (name === "InvoiceCreated") {
              const invoice = (log.args as any)?.invoice as
                | {
                    invoiceNonce?: bigint;
                    buyer?: string;
                    seller?: string;
                    price?: bigint;
                    balance?: bigint;
                    amountPaid?: bigint;
                    createdAt?: bigint;
                    paymentToken?: string;
                    paidAt?: bigint;
                    releaseAt?: bigint;
                  }
                | undefined;

              const buyer = invoice?.buyer?.toLowerCase?.();
              const seller = invoice?.seller?.toLowerCase?.();
              const contractInvoiceId = invoiceId;
              const displayId =
                invoice?.invoiceNonce?.toString() ?? contractInvoiceId;
              const historyTime = invoice?.createdAt
                ? invoice.createdAt.toString()
                : batchTime;

              if (
                address &&
                (buyer === address.toLowerCase() ||
                  seller === address.toLowerCase())
              ) {
                const type =
                  seller === address.toLowerCase()
                    ? ("IssuedInvoice" as const)
                    : ("ReceivedInvoice" as const);
                const marketKey = getInvoiceMergeKey({
                  invoiceId: contractInvoiceId,
                  type,
                  source: "Marketplace",
                });
                if (
                  !updatedMap.has(marketKey) &&
                  contractInvoiceId &&
                  invoice
                ) {
                  const nextInvoice = {
                    id: displayId,
                    invoiceId: BigInt(contractInvoiceId),
                    createdAt: invoice.createdAt
                      ? unixToGMT(Number(invoice.createdAt))
                      : null,
                    paidAt:
                      invoice.paidAt && Number(invoice.paidAt) > 0
                        ? unixToGMT(Number(invoice.paidAt))
                        : "Not Paid",
                    status: "AWAITING PAYMENT",
                    price: toRawString(invoice.price) ?? null,
                    amountPaid:
                      toRawString(invoice.amountPaid ?? invoice.balance) ?? "0",
                    type,
                    contract: contractAddress,
                    buyer: invoice.buyer ?? "",
                    seller: invoice.seller ?? "",
                    source: "Marketplace",
                    paymentToken: invoice.paymentToken ?? "",
                    releaseAt: invoice.releaseAt
                      ? invoice.releaseAt.toString()
                      : undefined,
                    history: appendHistoryEntry(undefined, "CREATED", historyTime),
                  } as Invoice;
                  updatedMap.set(marketKey, nextInvoice);
                  liveInvoices.push(nextInvoice);
                }
              }
              continue;
            }

            if (!invoiceId) continue;

            const status = statusFromEvent[name];
            let releaseUpdate: string | undefined;

            if (name === "UpdateReleaseTime") {
              releaseUpdate = addSeconds(batchTime, logArgs?.newHoldPeriod);
            }

            const existingInvoice = findMarketplaceInvoice(
              updatedMap.values(),
              invoiceId,
            );
            if (!existingInvoice) {
              if (hydrateMarketplaceInvoiceFromChain) {
                const eventFields: Partial<Invoice> = {};
                if (name === "InvoicePaid") {
                  eventFields.amountPaid = toRawString(logArgs?.amount);
                  eventFields.paymentToken = logArgs?.paymentToken;
                  eventFields.releaseAt = toRawString(logArgs?.releaseAt);
                  eventFields.paymentTxHash = log.transactionHash;
                  eventFields.paidAt = batchTime;
                }
                if (name === "Refunded") {
                  eventFields.amountRefunded = toRawString(logArgs?.amount);
                  eventFields.refundTxHash = log.transactionHash;
                }
                if (name === "PaymentReleased") {
                  eventFields.amountReleased = toRawString(
                    logArgs?.sellerAmount,
                  );
                  eventFields.paymentToken = logArgs?.currency;
                  eventFields.releaseHash = log.transactionHash;
                  eventFields.releasedAt = batchTime;
                }
                if (name === "DisputeSettled") {
                  eventFields.sellerAmountReceivedAfterDispute = toRawString(
                    logArgs?.sellerAmount,
                  );
                  eventFields.buyerAmountReceivedAfterDispute = toRawString(
                    logArgs?.buyerAmount,
                  );
                  eventFields.amountReleased =
                    eventFields.sellerAmountReceivedAfterDispute;
                  eventFields.amountRefunded =
                    eventFields.buyerAmountReceivedAfterDispute;
                  eventFields.disputeSettledTxHash = log.transactionHash;
                }
                if (releaseUpdate) {
                  eventFields.releaseAt = releaseUpdate;
                }
                queueMicrotask(() => {
                  void hydrateMarketplaceInvoiceFromChain(
                    BigInt(invoiceId),
                    status,
                    log.transactionHash,
                    eventFields,
                  );
                });
              }
              continue;
            }

            const inv = existingInvoice;
            const updatedFields: Partial<Invoice> = {
              status: status ?? inv.status,
              history: status
                ? appendHistoryEntry(inv.history, status, batchTime)
                : inv.history,
            };

            if (name === "InvoicePaid") {
              if (logArgs?.amount !== undefined) {
                updatedFields.amountPaid = toRawString(logArgs.amount);
              }
              updatedFields.paymentToken =
                logArgs?.paymentToken ?? inv.paymentToken;
              updatedFields.releaseAt =
                toRawString(logArgs?.releaseAt) ?? inv.releaseAt;
              updatedFields.paymentTxHash =
                log.transactionHash ?? inv.paymentTxHash;
              updatedFields.paidAt =
                inv.paidAt && inv.paidAt !== "Not Paid" ? inv.paidAt : batchTime;
            }

            if (name === "Refunded") {
              if (logArgs?.amount !== undefined) {
                const previousRefunded =
                  inv.amountRefunded && /^\d+$/.test(inv.amountRefunded)
                    ? BigInt(inv.amountRefunded)
                    : BigInt(0);
                updatedFields.amountRefunded = (
                  previousRefunded + logArgs.amount
                ).toString();
              }
              updatedFields.refundTxHash = log.transactionHash ?? inv.refundTxHash;
            }

            if (name === "PaymentReleased") {
              if (logArgs?.sellerAmount !== undefined) {
                updatedFields.amountReleased = toRawString(logArgs.sellerAmount);
              }
              updatedFields.paymentToken =
                logArgs?.currency ?? inv.paymentToken;
              updatedFields.releaseHash = log.transactionHash ?? inv.releaseHash;
              updatedFields.releasedAt = batchTime;
            }

            if (releaseUpdate) {
              updatedFields.releaseAt = releaseUpdate;
            }

            if (name === "DisputeSettled") {
              const sellerAmount = toRawString(logArgs?.sellerAmount);
              const buyerAmount = toRawString(logArgs?.buyerAmount);
              updatedFields.sellerAmountReceivedAfterDispute =
                sellerAmount ?? inv.sellerAmountReceivedAfterDispute;
              updatedFields.buyerAmountReceivedAfterDispute =
                buyerAmount ?? inv.buyerAmountReceivedAfterDispute;
              updatedFields.amountReleased =
                sellerAmount ?? inv.amountReleased;
              updatedFields.amountRefunded =
                buyerAmount ?? inv.amountRefunded;
              updatedFields.disputeSettledTxHash =
                log.transactionHash ?? inv.disputeSettledTxHash;
            }

            const nextInvoice = { ...inv, ...updatedFields };
            updatedMap.set(getInvoiceMergeKey(inv), nextInvoice);
            liveInvoices.push(nextInvoice);
          }

          if (liveInvoices.length > 0) {
            queueMicrotask(() => onLiveInvoices?.(liveInvoices));
          }

          return Array.from(updatedMap.values());
        });
      },
      onError: (err) =>
        console.error("marketplace invoice status subscription error", err),
    });

    return () => {
      unwatch();
    };
  }, [
    active,
    publicClient,
    address,
    chainId,
    setInvoiceData,
    onLiveInvoices,
    hydrateMarketplaceInvoiceFromChain,
  ]);
}
