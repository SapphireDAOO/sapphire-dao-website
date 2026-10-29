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
  invoicesRef: React.RefObject<Invoice[]>;
  setInvoiceData: React.Dispatch<React.SetStateAction<Invoice[]>>;
  findTrackedInvoice: (
    invoiceId: string,
    source: "Simple",
  ) => Invoice | undefined;
  updateSimpleInvoiceTiming: (invoiceId: bigint) => Promise<void>;
  hydrateSimpleInvoiceFromChain: (
    invoiceId: bigint,
    txHash?: string,
    eventStatus?: Invoice["status"],
  ) => Promise<void>;
  onLiveInvoices?: (invoices: Invoice[]) => void;
  onInvoiceStatus?: (invoiceId: string, status: Invoice["status"]) => void;
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

type LogOp =
  | { kind: "created"; invoice: Invoice }
  | {
      kind: "status";
      invoiceId: string;
      name: string;
      status: Invoice["status"];
      txHash?: string;
      amountPaid?: bigint;
      buyer?: string;
      sellerActionDeadline?: bigint;
      fallback?: Invoice;
    };

interface ApplyResult {
  changedRows: Invoice[];
  hydrates: Map<string, { txHash?: string; status: Invoice["status"] }>;
  acceptedIds: Set<string>;
}

// Pure apart from mutating `map`, so it can run in the
// state updater and again against the ref for side effects.
const applyOps = (
  invoiceMap: Map<string, Invoice>,
  ops: LogOp[],
  batchTime: string,
  findTracked: (invoiceId: string) => Invoice | undefined,
): ApplyResult => {
  const changedRows: Invoice[] = [];
  const hydrates = new Map<
    string,
    { txHash?: string; status: Invoice["status"] }
  >();
  const acceptedIds = new Set<string>();

  for (const op of ops) {
    if (op.kind === "created") {
      const key = getInvoiceMergeKey(op.invoice);
      if (invoiceMap.has(key)) continue;
      invoiceMap.set(key, op.invoice);
      changedRows.push(op.invoice);
      continue;
    }

    const existingInvoice =
      findSimpleInvoice(invoiceMap.values(), op.invoiceId) ??
      findTracked(op.invoiceId);

    if (!existingInvoice) {
      if (!op.fallback) continue;

      hydrates.set(op.invoiceId, { txHash: op.txHash, status: op.status });
      const key = getInvoiceMergeKey(op.fallback);
      if (!invoiceMap.has(key)) {
        invoiceMap.set(key, op.fallback);
        changedRows.push(op.fallback);
      }

      continue;
    }

    const updatedFields: Partial<Invoice> = {
      status: op.status,
      history: appendHistoryEntry(
        existingInvoice.history,
        op.status,
        batchTime,
      ),
    };

    if (op.name === "InvoicePaid") {
      if (op.amountPaid !== undefined) {
        updatedFields.amountPaid = formatEther(op.amountPaid);
      }

      if (op.buyer) {
        updatedFields.buyer = op.buyer;
      }

      if (op.sellerActionDeadline !== undefined) {
        updatedFields.sellerActionDeadline = op.sellerActionDeadline.toString();
      }

      updatedFields.paymentTxHash = op.txHash ?? existingInvoice.paymentTxHash;

      updatedFields.paidAt =
        !existingInvoice.paidAt || existingInvoice.paidAt === "Not Paid"
          ? batchTime
          : existingInvoice.paidAt;
    }

    if (op.name === "InvoiceRejected" || op.name === "InvoiceRefunded") {
      updatedFields.refundTxHash = op.txHash ?? existingInvoice.refundTxHash;
    }

    if (op.name === "InvoiceReleased") {
      updatedFields.releaseHash = op.txHash ?? existingInvoice.releaseHash;
    }

    const nextInvoice = {
      ...existingInvoice,
      ...updatedFields,
    };

    invoiceMap.set(getInvoiceMergeKey(existingInvoice), nextInvoice);
    changedRows.push(nextInvoice);

    if (op.name === "InvoiceAccepted") {
      acceptedIds.add(op.invoiceId);
    }
  }

  return { changedRows, hydrates, acceptedIds };
};

export function useSimpleInvoiceEvents({
  active,
  address,
  chainId,
  publicClient,
  invoicesRef,
  setInvoiceData,
  findTrackedInvoice,
  updateSimpleInvoiceTiming,
  hydrateSimpleInvoiceFromChain,
  onLiveInvoices,
  onInvoiceStatus,
}: Params) {
  useEffect(() => {
    if (!active || !publicClient || !address) return;

    const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
    if (!contractAddress) return;

    const userAddress = address.toLowerCase();
    const findTracked = (invoiceId: string) =>
      findTrackedInvoice(invoiceId, "Simple");

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: simpleEvents,

      onLogs: (logs) => {
        const batchTime = nowInSeconds();
        const ops: LogOp[] = [];

        for (const log of logs) {
          const name = log.eventName ?? "";

          const args = log.args as
            | {
                invoiceId?: bigint;
                invoiceNonce?: bigint;
                buyer?: string;
                seller?: string;
                price?: bigint;
                expiresAt?: number;
                amountPaid?: bigint;
                sellerActionDeadline?: bigint;
              }
            | undefined;

          if (name === "InvoiceCreated") {
            const invoiceId = args?.invoiceId?.toString();
            const seller = args?.seller;

            // A new invoice has no buyer yet, so only its seller follows it.
            if (!invoiceId || seller?.toLowerCase() !== userAddress) continue;

            ops.push({
              kind: "created",
              invoice: {
                id: args?.invoiceNonce?.toString() ?? invoiceId,
                invoiceId: BigInt(invoiceId),
                createdAt: unixToGMT(Number(batchTime)),
                paidAt: "Not Paid",
                status: "AWAITING PAYMENT",
                price: args?.price ? formatEther(args.price) : null,
                amountPaid: "0",
                type: "Seller",
                contract: contractAddress,
                buyer: "",
                seller,
                source: "Simple",
                expiresAt: args?.expiresAt?.toString(),
                history: appendHistoryEntry(undefined, "CREATED", batchTime),
              } as Invoice,
            });
            continue;
          }

          const invoiceId = (
            args?.invoiceId ?? args?.invoiceNonce
          )?.toString();

          if (!invoiceId) continue;

          const status = statusFromEvent[name];
          if (!status) continue;

          let fallback: Invoice | undefined;
          if (name === "InvoicePaid") {
            const buyer = args?.buyer?.toLowerCase?.();

            if (buyer === userAddress) {
              fallback = {
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
                sellerActionDeadline: args?.sellerActionDeadline?.toString(),
                paymentTxHash: log.transactionHash ?? undefined,
                history: appendHistoryEntry(undefined, "PAID", batchTime),
              } as Invoice;
            }
          }

          ops.push({
            kind: "status",
            invoiceId,
            name,
            status,
            txHash: log.transactionHash ?? undefined,
            amountPaid: args?.amountPaid,
            buyer: args?.buyer,
            sellerActionDeadline: args?.sellerActionDeadline,
            fallback,
          });
        }

        if (ops.length === 0) return;

        // Before the ownership filter: the pay page
        // needs its invoice's status whoever owns it.
        if (onInvoiceStatus) {
          for (const op of ops) {
            if (op.kind === "status") onInvoiceStatus(op.invoiceId, op.status);
          }
        }

        setInvoiceData((prev) => {
          const invoiceMap = new Map<string, Invoice>(
            prev.map((inv) => [getInvoiceMergeKey(inv), inv]),
          );
          const { changedRows } = applyOps(
            invoiceMap,
            ops,
            batchTime,
            findTracked,
          );
          return changedRows.length > 0
            ? Array.from(invoiceMap.values())
            : prev;
        });

        const overlay = new Map<string, Invoice>(
          invoicesRef.current.map((inv) => [getInvoiceMergeKey(inv), inv]),
        );
        const { changedRows, hydrates, acceptedIds } = applyOps(
          overlay,
          ops,
          batchTime,
          findTracked,
        );

        if (changedRows.length > 0) {
          onLiveInvoices?.(changedRows);
        }

        acceptedIds.forEach((id) => {
          void updateSimpleInvoiceTiming(BigInt(id)).catch(() => {});
        });

        hydrates.forEach(({ txHash, status }, id) => {
          void hydrateSimpleInvoiceFromChain(BigInt(id), txHash, status).catch(
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
    invoicesRef,
    setInvoiceData,
    findTrackedInvoice,
    updateSimpleInvoiceTiming,
    hydrateSimpleInvoiceFromChain,
    onLiveInvoices,
    onInvoiceStatus,
  ]);
}
