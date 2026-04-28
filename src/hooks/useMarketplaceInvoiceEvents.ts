/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { formatEther, type AbiEvent } from "viem";
import type { PublicClient } from "viem";
import { ADVANCED_PAYMENT_PROCESSOR } from "@/constants";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { appendHistoryEntry, nowInSeconds } from "@/lib/invoiceHistory";
import { unixToGMT } from "@/utils";
import type { Invoice } from "@/model/model";

interface Params {
  active: boolean;
  address: string | undefined;
  chainId: number;
  publicClient: PublicClient | undefined;
  setInvoiceData: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onLiveInvoices?: (invoices: Invoice[]) => void;
}

export function useMarketplaceInvoiceEvents({
  active,
  address,
  chainId,
  publicClient,
  setInvoiceData,
  onLiveInvoices,
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

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: marketEvents,
      onLogs: (logs) => {
        const batchTime = nowInSeconds();
        setInvoiceData((prev) => {
          const liveInvoices: Invoice[] = [];
          // Key by `id` (nonce). `invoiceId` differs by source — see useSimpleInvoiceEvents.
          const updatedMap = new Map<string, Invoice>(
            prev.map((inv) => [`${inv.id}-${inv.source}`, inv]),
          );

          for (const log of logs) {
            const name = log.eventName ?? "";
            const logArgs = log.args as
              | {
                  invoiceId?: bigint;
                  invoiceNonce?: bigint;
                  amount?: bigint;
                  sellerAmount?: bigint;
                  newHoldPeriod?: bigint;
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
              const invoiceId = invoice?.invoiceNonce?.toString();
              const historyTime = invoice?.createdAt
                ? invoice.createdAt.toString()
                : batchTime;

              if (
                address &&
                (buyer === address.toLowerCase() ||
                  seller === address.toLowerCase())
              ) {
                const marketKey = `${invoiceId}-Marketplace`;
                if (!updatedMap.has(marketKey) && invoiceId && invoice) {
                  const nextInvoice = {
                    id: invoiceId,
                    invoiceId: BigInt(invoiceId),
                    createdAt: invoice.createdAt
                      ? unixToGMT(Number(invoice.createdAt))
                      : null,
                    paidAt:
                      invoice.paidAt && Number(invoice.paidAt) > 0
                        ? unixToGMT(Number(invoice.paidAt))
                        : "Not Paid",
                    status: "AWAITING PAYMENT",
                    price: invoice.price ? formatEther(invoice.price) : null,
                    amountPaid: (invoice.balance ?? invoice.amountPaid)
                      ? formatEther(
                          invoice.balance ?? invoice.amountPaid ?? BigInt(0),
                        )
                      : "0",
                    type:
                      seller === address.toLowerCase()
                        ? ("IssuedInvoice" as const)
                        : ("ReceivedInvoice" as const),
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
            let releaseUpdate: bigint | undefined;

            if (name === "UpdateReleaseTime") {
              releaseUpdate = logArgs?.newHoldPeriod;
            }

            const marketKey = `${invoiceId}-Marketplace`;
            if (!updatedMap.has(marketKey)) continue;

            const inv = updatedMap.get(marketKey)!;
            const updatedFields: Partial<Invoice> = {
              status: status ?? inv.status,
              history: status
                ? appendHistoryEntry(inv.history, status, batchTime)
                : inv.history,
            };

            if (name === "InvoicePaid") {
              if (logArgs?.amount !== undefined) {
                updatedFields.amountPaid = formatEther(logArgs.amount);
              }
              updatedFields.paymentTxHash =
                log.transactionHash ?? inv.paymentTxHash;
              updatedFields.paidAt =
                inv.paidAt && inv.paidAt !== "Not Paid" ? inv.paidAt : batchTime;
            }

            if (name === "Refunded") {
              if (logArgs?.amount !== undefined) {
                updatedFields.amountPaid = formatEther(logArgs.amount);
              }
              updatedFields.refundTxHash = log.transactionHash ?? inv.refundTxHash;
            }

            if (name === "PaymentReleased") {
              updatedFields.releaseHash = log.transactionHash ?? inv.releaseHash;
            }

            if (releaseUpdate) {
              updatedFields.releaseAt = releaseUpdate.toString();
            }

            const nextInvoice = { ...inv, ...updatedFields };
            updatedMap.set(marketKey, nextInvoice);
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
  }, [active, publicClient, address, chainId, setInvoiceData, onLiveInvoices]);
}
