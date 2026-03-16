import { History, Invoice } from "@/model/model";

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
