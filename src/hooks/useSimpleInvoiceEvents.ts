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
  /** Latest committed invoice list; used to derive side effects (hydration,
   *  timing refreshes, live publishes) outside the state updater. */
  invoicesRef: React.RefObject<Invoice[]>;
  setInvoiceData: React.Dispatch<React.SetStateAction<Invoice[]>>;
  updateSimpleInvoiceTiming: (invoiceId: bigint) => Promise<void>;
  hydrateSimpleInvoiceFromChain: (
    invoiceId: bigint,
    txHash?: string,
    eventStatus?: Invoice["status"],
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

/** A decoded log, reduced to the plain data the merge below needs. */
type LogOp =
  | { kind: "created"; invoice: Invoice }
  | {
      kind: "status";
      invoiceId: string;
      name: string;
      status: Invoice["status"];
      txHash?: string;
      amountPaid?: bigint;
      refundedAmountPaid?: bigint;
      buyer?: string;
      expiresAt?: bigint;
      /** Synthetic buyer-side invoice to insert when the id is unknown. */
      fallback?: Invoice;
    };

interface ApplyResult {
  /** Rows inserted or patched, in op order (feeds the live overlay). */
  changedRows: Invoice[];
  /** Unknown invoices that need a chain read, keyed by invoice id. */
  hydrates: Map<string, { txHash?: string; status: Invoice["status"] }>;
  /** Known invoices whose timing fields need a chain refresh. */
  acceptedIds: Set<string>;
}

/**
 * Apply a batch of ops to a merge-key map of invoices. Pure aside from
 * mutating the passed-in map, so it can run both inside the state updater
 * (against the real previous state) and outside it (against the ref snapshot)
 * to derive side effects — React state updaters must stay side-effect free
 * and are not guaranteed to run at dispatch time, so nothing consumed after
 * setState may be collected inside one.
 */
const applyOps = (
  invoiceMap: Map<string, Invoice>,
  ops: LogOp[],
  batchTime: string,
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

    const existingInvoice = findSimpleInvoice(
      invoiceMap.values(),
      op.invoiceId,
    );

    if (!existingInvoice) {
      hydrates.set(op.invoiceId, { txHash: op.txHash, status: op.status });

      if (op.fallback) {
        const key = getInvoiceMergeKey(op.fallback);
        if (!invoiceMap.has(key)) {
          invoiceMap.set(key, op.fallback);
          changedRows.push(op.fallback);
        }
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

      if (op.expiresAt !== undefined) {
        updatedFields.expiresAt = op.expiresAt.toString();
      }

      updatedFields.paymentTxHash = op.txHash ?? existingInvoice.paymentTxHash;

      updatedFields.paidAt =
        !existingInvoice.paidAt || existingInvoice.paidAt === "Not Paid"
          ? batchTime
          : existingInvoice.paidAt;
    }

    if (op.name === "InvoiceRejected" || op.name === "InvoiceRefunded") {
      if (op.refundedAmountPaid !== undefined) {
        updatedFields.amountPaid = formatEther(op.refundedAmountPaid);
      }

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
        const ops: LogOp[] = [];

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
            const historyTime = invoice.createdAt
              ? invoice.createdAt.toString()
              : batchTime;

            ops.push({
              kind: "created",
              invoice: {
                id: displayId,
                invoiceId: BigInt(invoiceId),
                createdAt: invoice.createdAt
                  ? unixToGMT(Number(invoice.createdAt))
                  : null,
                paidAt: "Not Paid",
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
                expiresAt: args?.expiresAt?.toString(),
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
            refundedAmountPaid: args?.invoice?.amountPaid,
            buyer: args?.buyer,
            expiresAt: args?.expiresAt,
            fallback,
          });
        }

        if (ops.length === 0) return;

        setInvoiceData((prev) => {
          const invoiceMap = new Map<string, Invoice>(
            prev.map((inv) => [getInvoiceMergeKey(inv), inv]),
          );
          const { changedRows } = applyOps(invoiceMap, ops, batchTime);
          return changedRows.length > 0
            ? Array.from(invoiceMap.values())
            : prev;
        });

        // Re-run the same pure merge against the latest committed snapshot to
        // derive the side effects. The ref can trail the update above by one
        // commit; hydration backfills anything that slips through.
        const overlay = new Map<string, Invoice>(
          invoicesRef.current.map((inv) => [getInvoiceMergeKey(inv), inv]),
        );
        const { changedRows, hydrates, acceptedIds } = applyOps(
          overlay,
          ops,
          batchTime,
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
    updateSimpleInvoiceTiming,
    hydrateSimpleInvoiceFromChain,
    onLiveInvoices,
  ]);
}
