import { useEffect } from "react";
import { formatEther, type AbiEvent } from "viem";
import type { PublicClient } from "viem";
import { SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { appendHistoryEntry, nowInSeconds } from "@/lib/invoiceHistory";
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

// expectation
// trigger when a transaction occurs, cache the result, including current block number have a ttl too
// if reload occurs, get current block number of the graph, if less than that on the tx, use cached data
// else use that of the graph
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

    const statusFromEvent: Record<string, Invoice["status"]> = {
      InvoicePaid: "PAID",
      InvoiceAccepted: "ACCEPTED",
      InvoiceRejected: "REFUNDED",
      InvoiceRefunded: "REFUNDED",
      InvoiceReleased: "RELEASED",
      InvoiceCanceled: "CANCELED",
      InvoiceCreated: "AWAITING PAYMENT",
    };

    const simpleEvents = (
      paymentProcessor as readonly { type: string }[]
    ).filter((item): item is AbiEvent => item.type === "event");

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: simpleEvents,
      onLogs: (logs) => {
        const batchTime = nowInSeconds();
        const acceptedinvoiceIds: string[] = [];
        const hydrateRequests = new Map<string, string | undefined>();
        setInvoiceData((prev) => {
          const liveInvoices: Invoice[] = [];
          // Key by `id` (the nonce string). `invoiceId` is not stable across
          // sources: event-hook entries hold BigInt(nonce); subgraph entries
          // hold the subgraph entity id ("0x..."). Mixing them caused dupes.
          const updatedMap = new Map<string, Invoice>(
            prev.map((inv) => [`${inv.id}-${inv.source}`, inv]),
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

            // check id nonce thing
            const invoiceId = (
              args?.invoiceId ?? args?.invoiceNonce
            )?.toString();

            const invoice = args?.invoice;

            // each function for various types of event
            if (name === "InvoiceCreated") {
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
                // is this neccessary??
                const simpleKey = `${invoiceId}-Simple`;
                if (!updatedMap.has(simpleKey) && invoiceId && invoice) {
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
                    amountPaid:
                      (invoice.balance ?? invoice.amountPaid)
                        ? formatEther(
                            invoice.balance ?? invoice.amountPaid ?? BigInt(0),
                          )
                        : "0",
                    type:
                      seller === address.toLowerCase()
                        ? ("Seller" as const)
                        : ("Buyer" as const),
                    contract: contractAddress,
                    buyer: invoice.buyer ?? "",
                    seller: invoice.seller ?? "",
                    source: "Simple",
                    invalidateAt: invoice.invalidateAt
                      ? invoice.invalidateAt.toString()
                      : undefined,
                    expiresAt: invoice.expiresAt
                      ? invoice.expiresAt.toString()
                      : undefined,
                    history: appendHistoryEntry(
                      undefined,
                      "CREATED",
                      historyTime,
                    ),
                  } as Invoice;
                  updatedMap.set(simpleKey, nextInvoice);
                  liveInvoices.push(nextInvoice);
                }
              }
              continue;
            }

            if (!invoiceId) continue;

            const status = statusFromEvent[name];
            if (!status) continue;

            const simpleKey = `${invoiceId}-Simple`;
            if (!updatedMap.has(simpleKey)) {
              if (name === "InvoicePaid") {
                const buyer = args?.buyer?.toLowerCase?.();
                const isBuyer = address && buyer === address.toLowerCase();

                if (isBuyer && invoiceId) {
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
                  updatedMap.set(simpleKey, nextInvoice);
                  liveInvoices.push(nextInvoice);
                }

                hydrateRequests.set(invoiceId, log.transactionHash);
              }
              continue;
            }

            const inv = updatedMap.get(simpleKey)!;
            const updatedFields: Partial<Invoice> = {
              status,
              history: appendHistoryEntry(inv.history, status, batchTime),
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
                log.transactionHash ?? inv.paymentTxHash;
              updatedFields.paidAt =
                !inv.paidAt || inv.paidAt === "Not Paid"
                  ? batchTime
                  : inv.paidAt;
            }

            if (name === "InvoiceRejected" || name === "InvoiceRefunded") {
              if (invoice?.amountPaid !== undefined) {
                updatedFields.amountPaid = formatEther(invoice.amountPaid);
              }
              updatedFields.refundTxHash =
                log.transactionHash ?? inv.refundTxHash;
            }

            if (name === "InvoiceReleased") {
              updatedFields.releaseHash =
                log.transactionHash ?? inv.releaseHash;
            }

            const nextInvoice = { ...inv, ...updatedFields };
            updatedMap.set(simpleKey, nextInvoice);
            liveInvoices.push(nextInvoice);

            if (name === "InvoiceAccepted") {
              acceptedinvoiceIds.push(invoiceId);
            }
          }

          if (liveInvoices.length > 0) {
            queueMicrotask(() => onLiveInvoices?.(liveInvoices));
          }

          return Array.from(updatedMap.values());
        });

        acceptedinvoiceIds.forEach((id) => {
          try {
            void updateSimpleInvoiceTiming(BigInt(id));
          } catch {
            // ignore invalid invoiceId parsing
          }
        });

        hydrateRequests.forEach((txHash, id) => {
          try {
            void hydrateSimpleInvoiceFromChain(BigInt(id), txHash);
          } catch {
            // ignore invalid invoiceId parsing
          }
        });
      },
      onError: (err) => console.error("invoice status subscription error", err),
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
