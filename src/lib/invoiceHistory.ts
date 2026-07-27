import { History, Invoice } from "@/model/model";

// Maps the subgraph's event-log `eventType` (new schema) onto the status labels
// the UI history timeline uses. Event types not listed (oracle/hold-period/escrow
// bookkeeping, etc.) are intentionally dropped from the user-facing history.
const EVENT_TYPE_TO_STATUS: Record<string, string> = {
  INVOICE_CREATED: "CREATED",
  INVOICE_PAID: "PAID",
  INVOICE_ACCEPTED: "ACCEPTED",
  INVOICE_RELEASED: "RELEASED",
  PAYMENT_RELEASED: "RELEASED",
  INVOICE_CANCELED: "CANCELED",
  INVOICE_REJECTED: "REFUNDED",
  INVOICE_REFUNDED: "REFUNDED",
  REFUNDED: "REFUNDED",
  DISPUTE_CREATED: "DISPUTED",
  DISPUTE_DISMISSED: "DISPUTE_DISMISSED",
  DISPUTE_RESOLVED: "DISPUTE_RESOLVED",
  DISPUTE_SETTLED: "DISPUTE_SETTLED",
};

// Lifecycle ordering used as a tiebreaker when several events share a timestamp
// (common locally / in batched txs, where the subgraph returns them in id order
// rather than logical order).
const EVENT_SEQUENCE: Record<string, number> = {
  INVOICE_CREATED: 0,
  META_INVOICE_CREATED: 0,
  ESCROW_CREATED: 1,
  INVOICE_PAID: 2,
  INVOICE_ACCEPTED: 3,
  DISPUTE_CREATED: 4,
  DISPUTE_DISMISSED: 5,
  DISPUTE_RESOLVED: 5,
  DISPUTE_SETTLED: 6,
  INVOICE_RELEASED: 7,
  PAYMENT_RELEASED: 7,
  INVOICE_REJECTED: 7,
  INVOICE_REFUNDED: 7,
  REFUNDED: 7,
  INVOICE_CANCELED: 7,
};

type RawInvoiceEvent = {
  eventType?: string;
  txHash?: string;
  timestamp?: string;
};

/**
 * The subgraph migrated from flat invoice fields (createdAt, paidAt,
 * paymentTxHash, history, historyTime, …) to an `events` relation. This rebuilds
 * the old wire shape from `events` so the existing transformers/consumers — which
 * read those flat fields — keep working unchanged. Pass a raw subgraph invoice;
 * returns it augmented with the derived legacy fields.
 */
export const flattenInvoiceEvents = <T extends Record<string, unknown>>(
  inv: T,
): T => {
  const events = Array.isArray((inv as { events?: RawInvoiceEvent[] }).events)
    ? [...((inv as { events?: RawInvoiceEvent[] }).events as RawInvoiceEvent[])]
    : [];

  // Events arrive in entity-id order, not chronological — sort by timestamp,
  // falling back to lifecycle order when timestamps tie (same block).
  events.sort((a, b) => {
    const ts = Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0);
    if (ts !== 0) return ts;
    const seqA = EVENT_SEQUENCE[a.eventType ?? ""] ?? Number.MAX_SAFE_INTEGER;
    const seqB = EVENT_SEQUENCE[b.eventType ?? ""] ?? Number.MAX_SAFE_INTEGER;
    return seqA - seqB;
  });

  const history: string[] = [];
  const historyTime: string[] = [];
  let createdAt: string | undefined;
  let paidAt: string | undefined;
  let releasedAt: string | undefined;
  let paymentTxHash: string | undefined;
  let releaseHash: string | undefined;
  let refundTxHash: string | undefined;
  let disputeSettledTxHash: string | undefined;
  let commisionTxHash: string | undefined;

  for (const ev of events) {
    const status = ev.eventType
      ? EVENT_TYPE_TO_STATUS[ev.eventType]
      : undefined;
    if (status && history[history.length - 1] !== status) {
      history.push(status);
      historyTime.push(ev.timestamp ?? "");
    }

    switch (ev.eventType) {
      case "INVOICE_CREATED":
        createdAt ??= ev.timestamp;
        break;
      case "INVOICE_PAID":
        paidAt ??= ev.timestamp;
        paymentTxHash ??= ev.txHash;
        break;
      case "INVOICE_RELEASED":
      case "PAYMENT_RELEASED":
        releasedAt ??= ev.timestamp;
        releaseHash ??= ev.txHash;
        // The protocol fee (commission) is transferred inside the release tx.
        commisionTxHash ??= ev.txHash;
        break;
      case "INVOICE_REFUNDED":
      case "INVOICE_REJECTED":
      case "REFUNDED":
        refundTxHash ??= ev.txHash;
        break;
      case "DISPUTE_SETTLED":
        disputeSettledTxHash ??= ev.txHash;
        // Intermediated invoices settled via dispute pay the fee in the settlement
        // tx instead of a release.
        commisionTxHash ??= ev.txHash;
        break;
    }
  }

  return {
    ...inv,
    createdAt,
    paidAt,
    // `releaseAt` is now an authoritative field on the invoice entity; prefer it
    // over the event-derived timestamp. The release tx hash still comes from events.
    releasedAt: (inv as { releaseAt?: string }).releaseAt ?? releasedAt,
    paymentTxHash,
    releaseHash,
    refundTxHash,
    disputeSettledTxHash,
    commisionTxHash,
    history,
    historyTime,
  };
};

export const normalizeHistoryStatus = (status?: string): string | undefined => {
  if (!status) return status;
  if (status === "AWAITING PAYMENT" || status === "INITIATED") return "CREATED";
  return status;
};

export const sortHistory = (status?: string[], time?: string[]): History[] => {
  const history: History[] = [];

  if (!status || !Array.isArray(status) || status.length === 0) return history;
  if (!time || !Array.isArray(time) || time.length === 0) {
    return status.map((s) => ({
      status: normalizeHistoryStatus(s) ?? "",
      time: "",
    }));
  }

  const length = Math.min(status.length, time.length);

  for (let i = 0; i < length; i++) {
    const normalized = normalizeHistoryStatus(status[i]);
    if (!normalized) continue;
    history.push({
      status: normalized,
      time: time[i],
    });
  }

  return history;
};

/** Build a minimal history array for marketplace invoices that lack subgraph history data */
export const synthesizeMarketplaceHistory = (inv: {
  history?: string[];
  historyTime?: string[];
  createdAt?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  paidAt?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}): History[] => {
  const history = sortHistory(inv.history, inv.historyTime);

  // Always ensure a CREATED entry exists from createdAt when not already present
  const hasCreated = history.some(
    (h) =>
      h.status === "CREATED" ||
      h.status === "AWAITING PAYMENT" ||
      h.status === "AWAITING_PAYMENT" ||
      h.status === "INITIATED",
  );

  const prefix: History[] =
    inv.createdAt && !hasCreated
      ? [{ status: "CREATED", time: inv.createdAt.toString() }]
      : [];

  if (history.length > 0) return [...prefix, ...history];

  const result: History[] = [...prefix];
  if (inv.paidAt) result.push({ status: "PAID", time: inv.paidAt.toString() });
  return result;
};

export const sortState = (state: string, voidAt?: string): string => {
  if (state === "CANCELED") {
    return "CANCELED";
  }

  // If created and already past voidAt, mark as expired first
  if (state === "CREATED" && voidAt && Date.now() > Number(voidAt) * 1000) {
    return "EXPIRED";
  }

  if (state === "CREATED" || state === "INITIATED") {
    return "AWAITING PAYMENT";
  }

  if (state === "REJECTED") {
    return "REFUNDED";
  }

  return state;
};

// Define a status priority so we can keep the "newer" one when merging
const STATUS_ORDER = [
  "AWAITING PAYMENT",
  "CREATED",
  "PAID",
  "ACCEPTED",
  "RELEASED",
  "REFUNDED",
  "CANCELED",
  "EXPIRED",
  "DISPUTED",
  "DISPUTE_RESOLVED",
  "DISPUTE_DISMISSED",
  "DISPUTE_SETTLED",
];

const getStatusRank = (status: string | undefined): number => {
  if (!status) return -1;
  const idx = STATUS_ORDER.indexOf(status);
  return idx === -1 ? STATUS_ORDER.length : idx;
};

export const pickNewerStatus = (existing: string, incoming: string): string => {
  const existingRank = getStatusRank(existing);
  const incomingRank = getStatusRank(incoming);
  // higher/equal rank means "later" or same status; never downgrade
  return incomingRank >= existingRank ? incoming : existing;
};

export const nowInSeconds = () => Math.floor(Date.now() / 1000).toString();

export const appendHistoryEntry = (
  history: History[] | undefined,
  status: string | undefined,
  time?: string,
): History[] | undefined => {
  const normalizedStatus = normalizeHistoryStatus(status);
  if (!normalizedStatus) return history;
  const entryTime = time ?? nowInSeconds();
  const existing = history ?? [];
  const last = existing[existing.length - 1];

  if (last && last.status === normalizedStatus) {
    return existing;
  }

  return [...existing, { status: normalizedStatus, time: entryTime }];
};

export const mergeHistory = (
  existing?: History[],
  incoming?: History[],
): History[] | undefined => {
  if (!incoming?.length) return existing;
  if (!existing?.length) {
    return incoming
      .map((entry) => ({
        status: normalizeHistoryStatus(entry.status) ?? entry.status,
        time: entry.time,
      }))
      .filter((entry) => Boolean(entry.status));
  }

  const toTimeNumber = (value: string | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };

  const mergedByStatus = new Map<string, History>();
  const push = (entry: History) => {
    const normalizedStatus = normalizeHistoryStatus(entry.status);
    if (!normalizedStatus) return;

    const existingEntry = mergedByStatus.get(normalizedStatus);
    if (!existingEntry) {
      mergedByStatus.set(normalizedStatus, {
        status: normalizedStatus,
        time: entry.time,
      });
      return;
    }

    const existingTime = toTimeNumber(existingEntry.time);
    const nextTime = toTimeNumber(entry.time);
    if (nextTime < existingTime) {
      mergedByStatus.set(normalizedStatus, {
        status: normalizedStatus,
        time: entry.time,
      });
    }
  };

  existing.forEach(push);
  incoming.forEach(push);

  const merged = Array.from(mergedByStatus.values());
  merged.sort((a, b) => toTimeNumber(a.time) - toTimeNumber(b.time));
  return merged;
};

export const getLastActionTime = (invoice: Invoice): string | undefined => {
  if (invoice.history && invoice.history.length > 0) {
    return invoice.history[invoice.history.length - 1].time;
  }
  if (invoice.paidAt !== "Not Paid") {
    return invoice.paidAt;
  }
  return invoice.createdAt === null ? undefined : invoice.createdAt;
};
