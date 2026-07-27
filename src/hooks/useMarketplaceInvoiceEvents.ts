/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { type AbiEvent } from "viem";
import type { PublicClient } from "viem";
import { INTERMEDIATED_PAYMENT_PROCESSOR } from "@/constants";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
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
   *  live publishes) outside the state updater. */
  invoicesRef: React.RefObject<Invoice[]>;
  setInvoiceData: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onLiveInvoices?: (invoices: Invoice[]) => void;
  hydrateMarketplaceInvoiceFromChain?: (
    invoiceId: bigint,
    status?: Invoice["status"],
    txHash?: string,
    eventFields?: Partial<Invoice>,
  ) => void | Promise<void>;
}

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
  intermediatedPaymentProcessor as readonly { type: string }[]
).filter((item): item is AbiEvent => item.type === "event");

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

/** A decoded log, reduced to the plain data the merge below needs. */
type LogOp =
  | { kind: "created"; invoice: Invoice }
  | {
      kind: "status";
      invoiceId: string;
      name: string;
      status?: Invoice["status"];
      txHash?: string;
      amount?: bigint;
      paymentToken?: string;
      currency?: string;
      sellerAmount?: bigint;
      buyerAmount?: bigint;
      releaseAt?: bigint;
      releaseUpdate?: string;
      /** Fields to hand to the chain hydration when the id is unknown. */
      eventFields: Partial<Invoice>;
    };

interface ApplyResult {
  /** Rows inserted or patched, in op order (feeds the live overlay). */
  changedRows: Invoice[];
  /** Unknown invoices that need a chain read, keyed by invoice id. */
  hydrates: Map<
    string,
    { status?: Invoice["status"]; txHash?: string; eventFields: Partial<Invoice> }
  >;
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
  const hydrates: ApplyResult["hydrates"] = new Map();

  for (const op of ops) {
    if (op.kind === "created") {
      const key = getInvoiceMergeKey(op.invoice);
      if (invoiceMap.has(key)) continue;
      invoiceMap.set(key, op.invoice);
      changedRows.push(op.invoice);
      continue;
    }

    const existingInvoice = findMarketplaceInvoice(
      invoiceMap.values(),
      op.invoiceId,
    );

    if (!existingInvoice) {
      hydrates.set(op.invoiceId, {
        status: op.status,
        txHash: op.txHash,
        eventFields: op.eventFields,
      });
      continue;
    }

    const inv = existingInvoice;
    const updatedFields: Partial<Invoice> = {
      status: op.status ?? inv.status,
      history: op.status
        ? appendHistoryEntry(inv.history, op.status, batchTime)
        : inv.history,
    };

    if (op.name === "InvoicePaid") {
      if (op.amount !== undefined) {
        updatedFields.amountPaid = toRawString(op.amount);
      }
      updatedFields.paymentToken = op.paymentToken ?? inv.paymentToken;
      updatedFields.releaseAt = toRawString(op.releaseAt) ?? inv.releaseAt;
      updatedFields.paymentTxHash = op.txHash ?? inv.paymentTxHash;
      updatedFields.paidAt =
        inv.paidAt && inv.paidAt !== "Not Paid" ? inv.paidAt : batchTime;
    }

    if (op.name === "Refunded") {
      if (op.amount !== undefined) {
        const previousRefunded =
          inv.amountRefunded && /^\d+$/.test(inv.amountRefunded)
            ? BigInt(inv.amountRefunded)
            : BigInt(0);
        updatedFields.amountRefunded = (
          previousRefunded + op.amount
        ).toString();
      }
      updatedFields.refundTxHash = op.txHash ?? inv.refundTxHash;
    }

    if (op.name === "PaymentReleased") {
      if (op.sellerAmount !== undefined) {
        updatedFields.amountReleased = toRawString(op.sellerAmount);
      }
      updatedFields.paymentToken = op.currency ?? inv.paymentToken;
      updatedFields.releaseHash = op.txHash ?? inv.releaseHash;
      updatedFields.releasedAt = batchTime;
    }

    if (op.releaseUpdate) {
      updatedFields.releaseAt = op.releaseUpdate;
    }

    if (op.name === "DisputeSettled") {
      const sellerAmount = toRawString(op.sellerAmount);
      const buyerAmount = toRawString(op.buyerAmount);
      updatedFields.sellerAmountReceivedAfterDispute =
        sellerAmount ?? inv.sellerAmountReceivedAfterDispute;
      updatedFields.buyerAmountReceivedAfterDispute =
        buyerAmount ?? inv.buyerAmountReceivedAfterDispute;
      updatedFields.amountReleased = sellerAmount ?? inv.amountReleased;
      updatedFields.amountRefunded = buyerAmount ?? inv.amountRefunded;
      updatedFields.disputeSettledTxHash =
        op.txHash ?? inv.disputeSettledTxHash;
    }

    const nextInvoice = { ...inv, ...updatedFields };
    invoiceMap.set(getInvoiceMergeKey(inv), nextInvoice);
    changedRows.push(nextInvoice);
  }

  return { changedRows, hydrates };
};

export function useMarketplaceInvoiceEvents({
  active,
  address,
  chainId,
  publicClient,
  invoicesRef,
  setInvoiceData,
  onLiveInvoices,
  hydrateMarketplaceInvoiceFromChain,
}: Params) {
  useEffect(() => {
    if (!active || !publicClient || !address) return;
    const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];
    if (!contractAddress) return;

    const userAddress = address.toLowerCase();

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: marketEvents,
      onLogs: (logs) => {
        const batchTime = nowInSeconds();
        const ops: LogOp[] = [];

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
          const invoiceId = (
            logArgs?.invoiceId ?? logArgs?.invoiceNonce
          )?.toString();

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

            const isUserInvoice =
              buyer === userAddress || seller === userAddress;

            if (isUserInvoice && contractInvoiceId && invoice) {
              const type =
                seller === userAddress
                  ? ("IssuedInvoice" as const)
                  : ("ReceivedInvoice" as const);

              ops.push({
                kind: "created",
                invoice: {
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
                  history: appendHistoryEntry(
                    undefined,
                    "CREATED",
                    historyTime,
                  ),
                } as Invoice,
              });
            }
            continue;
          }

          if (!invoiceId) continue;

          const status = statusFromEvent[name];
          let releaseUpdate: string | undefined;

          if (name === "UpdateReleaseTime") {
            releaseUpdate = addSeconds(batchTime, logArgs?.newHoldPeriod);
          }

          const eventFields: Partial<Invoice> = {};
          if (name === "InvoicePaid") {
            eventFields.amountPaid = toRawString(logArgs?.amount);
            eventFields.paymentToken = logArgs?.paymentToken;
            eventFields.releaseAt = toRawString(logArgs?.releaseAt);
            eventFields.paymentTxHash = log.transactionHash ?? undefined;
            eventFields.paidAt = batchTime;
          }
          if (name === "Refunded") {
            eventFields.amountRefunded = toRawString(logArgs?.amount);
            eventFields.refundTxHash = log.transactionHash ?? undefined;
          }
          if (name === "PaymentReleased") {
            eventFields.amountReleased = toRawString(logArgs?.sellerAmount);
            eventFields.paymentToken = logArgs?.currency;
            eventFields.releaseHash = log.transactionHash ?? undefined;
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
            eventFields.disputeSettledTxHash =
              log.transactionHash ?? undefined;
          }
          if (releaseUpdate) {
            eventFields.releaseAt = releaseUpdate;
          }

          ops.push({
            kind: "status",
            invoiceId,
            name,
            status,
            txHash: log.transactionHash ?? undefined,
            amount: logArgs?.amount,
            paymentToken: logArgs?.paymentToken,
            currency: logArgs?.currency,
            sellerAmount: logArgs?.sellerAmount,
            buyerAmount: logArgs?.buyerAmount,
            releaseAt: logArgs?.releaseAt,
            releaseUpdate,
            eventFields,
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
        const { changedRows, hydrates } = applyOps(overlay, ops, batchTime);

        if (changedRows.length > 0) {
          onLiveInvoices?.(changedRows);
        }

        if (hydrateMarketplaceInvoiceFromChain) {
          hydrates.forEach(({ status, txHash, eventFields }, id) => {
            void Promise.resolve(
              hydrateMarketplaceInvoiceFromChain(
                BigInt(id),
                status,
                txHash,
                eventFields,
              ),
            ).catch(() => {});
          });
        }
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
    invoicesRef,
    setInvoiceData,
    onLiveInvoices,
    hydrateMarketplaceInvoiceFromChain,
  ]);
}
