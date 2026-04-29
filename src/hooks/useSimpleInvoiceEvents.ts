import { useEffect } from "react";
import { formatEther, type AbiEvent } from "viem";
import type { PublicClient } from "viem";
import { SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { paymentProcessor } from "@/abis/PaymentProcessor";
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
  updateSimpleInvoiceTiming: (invoiceId: bigint) => Promise<void>;
  hydrateSimpleInvoiceFromChain: (
    invoiceId: bigint,
    txHash?: string,
  ) => Promise<void>;
  onLiveInvoices?: (invoices: Invoice[]) => void;
}

const simpleEvents = (paymentProcessor as readonly { type: string }[]).filter(
  (item): item is AbiEvent => item.type === "event",
);

const statusFromEvent: Record<string, Invoice["status"]> = {
  InvoicePaid: "PAID",
  InvoiceAccepted: "ACCEPTED",
  InvoiceRejected: "REFUNDED",
  InvoiceRefunded: "REFUNDED",
  InvoiceReleased: "RELEASED",
  InvoiceCanceled: "CANCELED",
  InvoiceCreated: "AWAITING PAYMENT",
};

const findSimpleInvoice = (
  invoices: Iterable<Invoice>,
  invoiceId: string,
) => {
  for (const invoice of invoices) {
    if (matchesInvoiceIdentity(invoice, invoiceId, "Simple")) {
      return invoice;
    }
  }

  return undefined;
};

export function useSimpleInvoiceEvents({
  active,
  address,
  chainId,
  publicClient,
  setInvoiceData,
  updateSimpleInvoiceTiming,
  hydrateSimpleInvoiceFromChain,
  onLiveInvoices,
}: Params) {
  useEffect(() => {
    if (!active || !publicClient || !address) return;

    const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
    if (!contractAddress) return;

    const userAddress = address.toLowerCase();

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: simpleEvents,

      onLogs: (logs) => {
        const batchTime = nowInSeconds();

        const acceptedInvoiceIds = new Set<string>();
        const hydrateRequests = new Map<string, string | undefined>();

        setInvoiceData((prev) => {
          const liveInvoices: Invoice[] = [];

          const updatedMap = new Map<string, Invoice>(
            prev.map((inv) => [getInvoiceMergeKey(inv), inv]),
          );

          for (const log of logs) {
            const name = log.eventName ?? "";

            const args = log.args as
              | {
                  invoiceId?: bigint;
                  invoiceNonce?: bigint;
                  buyer?: string;
                  amountPaid?: bigint;
                  expiresAt?: bigint;
                  invoice?: {
                    invoiceNonce?: bigint;
                    buyer?: string;
                    seller?: string;
                    price?: bigint;
                    balance?: bigint;
                    amountPaid?: bigint;
                    createdAt?: bigint;
                    paidAt?: bigint;
                    invalidateAt?: bigint;
                    expiresAt?: bigint;
                  };
                }
              | undefined;

            if (name === "InvoiceCreated") {
              const invoice = args?.invoice;
              const invoiceId = args?.invoiceId?.toString();
              const displayId = invoice?.invoiceNonce?.toString() ?? invoiceId;

              if (!invoice || !invoiceId) continue;

              const buyer = invoice.buyer?.toLowerCase?.();
              const seller = invoice.seller?.toLowerCase?.();

              const isUserInvoice =
                buyer === userAddress || seller === userAddress;

              if (!isUserInvoice) continue;

              const type = seller === userAddress ? "Seller" : "Buyer";
              const simpleKey = getInvoiceMergeKey({
                invoiceId,
                type,
                source: "Simple",
              });

              if (updatedMap.has(simpleKey)) continue;

              const historyTime = invoice.createdAt
                ? invoice.createdAt.toString()
                : batchTime;

              const nextInvoice = {
                id: displayId,
                invoiceId: BigInt(invoiceId),
                createdAt: invoice.createdAt
                  ? unixToGMT(Number(invoice.createdAt))
                  : null,
                paidAt: "Not Paid",
                // invoice.paidAt && Number(invoice.paidAt) > 0
                //   ? unixToGMT(Number(invoice.paidAt))
                //   :
                status: "AWAITING PAYMENT",
                price: invoice.price ? formatEther(invoice.price) : null,
                amountPaid: "0",
                type,
                contract: contractAddress,
                buyer: invoice.buyer ?? "",
                seller: invoice.seller ?? "",
                source: "Simple",
                invalidateAt: invoice.invalidateAt?.toString(),
                expiresAt: invoice.expiresAt?.toString(),
                history: appendHistoryEntry(undefined, "CREATED", historyTime),
              } as Invoice;

              updatedMap.set(simpleKey, nextInvoice);
              liveInvoices.push(nextInvoice);
              continue;
            }

            const invoiceId = (
              args?.invoiceId ?? args?.invoiceNonce
            )?.toString();

            if (!invoiceId) continue;

            const status = statusFromEvent[name];
            if (!status) continue;

            const existingInvoice = findSimpleInvoice(
              updatedMap.values(),
              invoiceId,
            );

            if (!existingInvoice) {
              hydrateRequests.set(invoiceId, log.transactionHash);

              if (name === "InvoicePaid") {
                const buyer = args?.buyer?.toLowerCase?.();
                const isBuyer = buyer === userAddress;

                if (isBuyer) {
                  const nextInvoice = {
                    id: invoiceId,
                    invoiceId: BigInt(invoiceId),
                    createdAt: null,
                    paidAt: batchTime,
                    status: "PAID",
                    price: null,
                    amountPaid:
                      args?.amountPaid !== undefined
                        ? formatEther(args.amountPaid)
                        : "0",
                    type: "Buyer",
                    contract: contractAddress,
                    buyer: args?.buyer ?? "",
                    seller: "",
                    source: "Simple",
                    expiresAt: args?.expiresAt?.toString(),
                    paymentTxHash: log.transactionHash,
                    history: appendHistoryEntry(undefined, "PAID", batchTime),
                  } as Invoice;

                  updatedMap.set(getInvoiceMergeKey(nextInvoice), nextInvoice);
                  liveInvoices.push(nextInvoice);
                }
              }

              continue;
            }

            const updatedFields: Partial<Invoice> = {
              status,
              history: appendHistoryEntry(
                existingInvoice.history,
                status,
                batchTime,
              ),
            };

            if (name === "InvoicePaid") {
              if (args?.amountPaid !== undefined) {
                updatedFields.amountPaid = formatEther(args.amountPaid);
              }

              if (args?.buyer) {
                updatedFields.buyer = args.buyer;
              }

              if (args?.expiresAt !== undefined) {
                updatedFields.expiresAt = args.expiresAt.toString();
              }

              updatedFields.paymentTxHash =
                log.transactionHash ?? existingInvoice.paymentTxHash;

              updatedFields.paidAt =
                !existingInvoice.paidAt || existingInvoice.paidAt === "Not Paid"
                  ? batchTime
                  : existingInvoice.paidAt;
            }

            if (name === "InvoiceRejected" || name === "InvoiceRefunded") {
              const invoice = args?.invoice;

              if (invoice?.amountPaid !== undefined) {
                updatedFields.amountPaid = formatEther(invoice.amountPaid);
              }

              updatedFields.refundTxHash =
                log.transactionHash ?? existingInvoice.refundTxHash;
            }

            if (name === "InvoiceReleased") {
              updatedFields.releaseHash =
                log.transactionHash ?? existingInvoice.releaseHash;
            }

            const nextInvoice = {
              ...existingInvoice,
              ...updatedFields,
            };

            updatedMap.set(getInvoiceMergeKey(existingInvoice), nextInvoice);
            liveInvoices.push(nextInvoice);

            if (name === "InvoiceAccepted") {
              acceptedInvoiceIds.add(invoiceId);
            }
          }

          if (liveInvoices.length > 0) {
            queueMicrotask(() => onLiveInvoices?.(liveInvoices));
          }

          return Array.from(updatedMap.values());
        });

        acceptedInvoiceIds.forEach((id) => {
          void updateSimpleInvoiceTiming(BigInt(id)).catch(() => {});
        });

        hydrateRequests.forEach((txHash, id) => {
          void hydrateSimpleInvoiceFromChain(BigInt(id), txHash).catch(
            () => {},
          );
        });
      },

      onError: (err) => {
        console.error("invoice status subscription error", err);
      },
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
    updateSimpleInvoiceTiming,
    hydrateSimpleInvoiceFromChain,
    onLiveInvoices,
  ]);
}
