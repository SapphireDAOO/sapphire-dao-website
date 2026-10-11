/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { LRUCache } from "lru-cache";
import {
  GET_ALL_INVOICES,
  invoiceOwnerQuery,
  smartInvoiceQuery,
  metaInvoiceQuery,
} from "@/services/graphql/queries";

import { useAccount, usePublicClient } from "wagmi";
import { unixToGMT } from "@/utils";
import {
  INTERMEDIATED_PAYMENT_PROCESSOR,
  BASE_SEPOLIA,
  SIMPLE_PAYMENT_PROCESSOR,
} from "@/constants";
import { AllInvoice, AdminAction, AllInvoicesData, Invoice } from "@/model/model";

import { formatEther } from "viem";
import { client } from "@/services/graphql/client";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import {
  sortState,
  pickNewerStatus,
  nowInSeconds,
  appendHistoryEntry,
  mergeHistory,
  getLastActionTime,
  flattenInvoiceEvents,
} from "@/lib/invoiceHistory";
import {
  getInvoiceCacheKey,
  readInvoiceCache,
  writeInvoiceCache,
} from "@/lib/invoiceCache";
import {
  getContractInvoiceIdBigInt,
  getDisplayInvoiceIdString,
  getInvoiceMergeKey,
  matchesInvoiceIdentity,
} from "@/lib/invoiceIdentifiers";
import { useSimpleInvoiceEvents } from "./useSimpleInvoiceEvents";
import { useIntermediatedInvoiceEvents } from "./useIntermediatedInvoiceEvents";
import { useIsWindowVisible } from "./useIsWindowVisible";
import type { CreatedSimpleInvoice } from "@/services/blockchain/SimplePaymentProcessor";
import type { InvoiceEventTab } from "@/context/contract-context";

const ERROR_BACKOFF_MS = 15_000;
// The subgraph's ceiling for `first`. Each list is walked with an id cursor,
// so a large protocol costs a handful of requests rather than one per 24 rows.
const ADMIN_PAGE_SIZE = 1000;
// The admin lists are not kept live, so this is how stale a revisit may be
// before the whole set is fetched again.
const ADMIN_INVOICE_CACHE_TTL_MS = 30_000;
const LIVE_INVOICE_OVERLAY_LIMIT = 100;
// invoiceData only feeds the pay page and is re-seeded from storage on load,
// so the newest invoices are all worth persisting.
const LOCAL_INVOICE_CACHE_LIMIT = 100;
const INVOICE_READ_TTL_MS = 5_000;
const INVOICE_READ_CACHE_MAX = 200;

const INTERMEDIATED_STATE_LABELS: Record<number, string> = {
  1: "CREATED",
  2: "PAID",
  3: "REFUNDED",
  4: "CANCELED",
  5: "DISPUTED",
  6: "DISPUTE_RESOLVED",
  7: "DISPUTE_DISMISSED",
  8: "DISPUTE_SETTLED",
  9: "RELEASED",
  10: "LOCKED",
};

const CHECKOUT_QUERIES = {
  smartInvoice: smartInvoiceQuery,
  metaInvoice: metaInvoiceQuery,
} as const;

// Chain reads of single invoices, keyed by chain, contract and invoice id.
// Bounded so a long session does not keep every invoice it ever read.
type InvoiceRead = { data: unknown };
const simpleInvoiceReadCache = new LRUCache<string, InvoiceRead>({
  max: INVOICE_READ_CACHE_MAX,
  ttl: INVOICE_READ_TTL_MS,
});
const simpleInvoiceReadInflight = new Map<string, Promise<unknown>>();
const intermediatedInvoiceReadCache = new LRUCache<string, InvoiceRead>({
  max: INVOICE_READ_CACHE_MAX,
  ttl: INVOICE_READ_TTL_MS,
});
const intermediatedInvoiceReadInflight = new Map<string, Promise<unknown>>();

const compareInvoicesByLastActionDesc = (a: Invoice, b: Invoice) => {
  const timeA = getLastActionTime(a);
  const timeB = getLastActionTime(b);
  if (timeA === timeB) return 0;
  if (!timeA) return 1;
  if (!timeB) return -1;
  return Number(timeB) - Number(timeA);
};

const getInvoiceCacheSignature = (invoices: Invoice[]) =>
  invoices
    .map(
      (invoice) =>
        `${invoice.invoiceId.toString()}:${invoice.type ?? ""}:${invoice.source ?? ""}:${invoice.status ?? ""}:${getLastActionTime(invoice) ?? ""}`,
    )
    .join("|");

const newestInvoices = (invoices: Invoice[]) =>
  [...invoices]
    .sort(compareInvoicesByLastActionDesc)
    .slice(0, LOCAL_INVOICE_CACHE_LIMIT);

export const useInvoiceData = () => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || BASE_SEPOLIA;

  const publicClient = usePublicClient({
    chainId,
  });

  const [invoiceData, setInvoiceData] = useState<Invoice[]>([]);
  const [liveInvoiceData, setLiveInvoiceData] = useState<Invoice[]>([]);
  const [allInvoiceData, setAllInvoiceData] = useState<AllInvoicesData>({
    invoices: [],
    actions: [],
    intermediatedInvoices: [],
  });

  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastCacheWriteSignatureRef = useRef("");

  // Pages holding the live event subscription open, newest last. Nothing is
  // watched unless a page asks: the subscription used to run on every route,
  // reading the chain for invoices that were not the user's.
  const [eventWatches, setEventWatches] = useState<
    { id: number; tab: InvoiceEventTab }[]
  >([]);
  const eventWatchIdRef = useRef(0);
  // The newest holder wins: on a route change the incoming page can register
  // before the outgoing one lets go.
  const activeEventTab =
    eventWatches.length > 0 ? eventWatches[eventWatches.length - 1].tab : null;
  const isWindowVisible = useIsWindowVisible();

  // Invoice lists on screen that live outside invoiceData (the dashboard's
  // paged query). Event handlers look here before deciding an invoice id
  // is someone else's.
  const trackedInvoiceListsRef = useRef(new Set<Invoice[]>());

  // Status listeners for single simple-processor invoices, keyed by id.
  const invoiceStatusListenersRef = useRef(
    new Map<string, Set<(status: Invoice["status"]) => void>>(),
  );

  const nextAllowedRequestRef = useRef<number>(0);
  const cacheKey = getInvoiceCacheKey(address, chainId);

  const publishLiveInvoices = useCallback((updates: Invoice[]) => {
    if (updates.length === 0) return;

    setLiveInvoiceData((prev) => {
      const byKey = new Map<string, Invoice>();

      for (const invoice of updates) {
        byKey.set(getInvoiceMergeKey(invoice), invoice);
      }

      for (const invoice of prev) {
        const key = getInvoiceMergeKey(invoice);
        if (!byKey.has(key)) {
          byKey.set(key, invoice);
        }
      }

      return Array.from(byKey.values()).slice(0, LIVE_INVOICE_OVERLAY_LIMIT);
    });
  }, []);

  const upsertLocalInvoice = useCallback(
    (invoice: Invoice) => {
      setInvoiceData((prev) => {
        const mergedByKey = new Map<string, Invoice>(
          prev.map((inv) => [getInvoiceMergeKey(inv), inv]),
        );
        const key = getInvoiceMergeKey(invoice);
        const existing = mergedByKey.get(key);

        mergedByKey.set(
          key,
          existing
            ? {
                ...existing,
                ...invoice,
                status: pickNewerStatus(
                  existing.status ?? "",
                  invoice.status ?? "",
                ),
                history: mergeHistory(existing.history, invoice.history),
              }
            : invoice,
        );

        return Array.from(mergedByKey.values()).sort(
          compareInvoicesByLastActionDesc,
        );
      });
      publishLiveInvoices([invoice]);
    },
    [publishLiveInvoices],
  );

  const addCreatedSimpleInvoice = useCallback(
    (created: CreatedSimpleInvoice) => {
      if (!address) return;
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return;

      const createdAt = created.createdAt?.toString() ?? nowInSeconds();
      const invoice: Invoice = {
        id: created.invoiceNonce?.toString() ?? created.invoiceId.toString(),
        invoiceId: created.invoiceId,
        createdAt: unixToGMT(Number(createdAt)),
        paidAt: "Not Paid",
        status: "AWAITING PAYMENT",
        price: created.price ? formatEther(created.price) : null,
        amountPaid: "0",
        type: "Seller",
        contract: contractAddress,
        seller: created.seller ?? address,
        buyer: "",
        source: "Simple",
        creationTxHash: created.txHash,
        expiresAt: created.expiresAt?.toString(),
        history: appendHistoryEntry(undefined, "CREATED", createdAt),
      };

      upsertLocalInvoice(invoice);
    },
    [address, chainId, upsertLocalInvoice],
  );

  // Keep refs so callbacks don't depend on state and cause re-subscribe loops
  const allInvoiceDataRef = useRef<AllInvoicesData>({
    invoices: [],
    actions: [],
    intermediatedInvoices: [],
  });
  const allInvoiceDataCacheRef = useRef<{
    chainId: number;
    timestamp: number;
    data: AllInvoicesData;
  } | null>(null);
  const allInvoiceDataInflightRef = useRef<Promise<AllInvoicesData> | null>(
    null,
  );
  useEffect(() => {
    allInvoiceDataRef.current = allInvoiceData;
  }, [allInvoiceData]);

  const invoiceDataStateRef = useRef<Invoice[]>([]);
  useEffect(() => {
    invoiceDataStateRef.current = invoiceData;
  }, [invoiceData]);

  useEffect(() => {
    if (!cacheKey) return;
    const signature = getInvoiceCacheSignature(invoiceData);
    if (signature === lastCacheWriteSignatureRef.current) return;
    if (cacheWriteTimeoutRef.current)
      clearTimeout(cacheWriteTimeoutRef.current);
    cacheWriteTimeoutRef.current = setTimeout(() => {
      lastCacheWriteSignatureRef.current = signature;
      writeInvoiceCache(cacheKey, newestInvoices(invoiceData));
      cacheWriteTimeoutRef.current = null;
    }, 1000);
    return () => {
      if (cacheWriteTimeoutRef.current)
        clearTimeout(cacheWriteTimeoutRef.current);
    };
  }, [cacheKey, invoiceData]);

  useEffect(() => {
    if (!cacheKey || typeof window === "undefined") return;

    const flushInvoiceCache = () => {
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
        cacheWriteTimeoutRef.current = null;
      }

      const signature = getInvoiceCacheSignature(invoiceData);
      if (signature === lastCacheWriteSignatureRef.current) return;

      lastCacheWriteSignatureRef.current = signature;
      writeInvoiceCache(cacheKey, newestInvoices(invoiceData));
    };

    window.addEventListener("pagehide", flushInvoiceCache);
    return () => {
      window.removeEventListener("pagehide", flushInvoiceCache);
    };
  }, [cacheKey, invoiceData]);

  const handleRateLimit = useCallback((message?: string) => {
    if (
      message &&
      (message.includes("Too Many Requests") || message.includes("429"))
    ) {
      nextAllowedRequestRef.current = Date.now() + ERROR_BACKOFF_MS;
    }
  }, []);

  const getAllInvoiceData = useCallback(
    async (force = false): Promise<AllInvoicesData> => {
      // Respect the 429 backoff unconditionally — retrying while rate limited
      // (even with nothing cached) only extends the lockout.
      if (Date.now() < nextAllowedRequestRef.current) {
        return allInvoiceDataRef.current;
      }

      const cached = allInvoiceDataCacheRef.current;
      if (
        !force &&
        cached &&
        cached.chainId === chainId &&
        Date.now() - cached.timestamp < ADMIN_INVOICE_CACHE_TTL_MS
      ) {
        return cached.data;
      }

      if (!force && allInvoiceDataInflightRef.current) {
        return allInvoiceDataInflightRef.current;
      }

      const request = (async (): Promise<AllInvoicesData> => {
        const invoices: AllInvoice[] = [];
        const actions: AdminAction[] = [];
        const intermediatedInvoices: AllInvoice[] = [];

        try {
          // Page through each list until exhausted; the subgraph caps a single
          // request at ADMIN_PAGE_SIZE, so a one-shot query would silently drop
          // anything past the first page. Pages are cursored on id rather than
          // skipped, since a large `skip` gets slower the deeper it goes. Each
          // list pages sequentially, but the lists run in parallel so total
          // latency is the longest list, not the sum of all of them.
          const fetchPagedList = async (
            list: "invoices" | "smartInvoices",
          ): Promise<any[]> => {
            const rows: any[] = [];
            let lastId = "";
            let more = true;

            while (more) {
              const queryResult = await client(chainId)
                .query(
                  GET_ALL_INVOICES,
                  {
                    first: ADMIN_PAGE_SIZE,
                    lastInvoiceId: lastId,
                    includeInvoices: list === "invoices",
                    lastSmartInvoiceId: lastId,
                    includeSmartInvoices: list === "smartInvoices",
                  },
                  // The TTL cache above decides freshness. urql's cache-first
                  // default would otherwise serve the first fetch forever.
                  { requestPolicy: "network-only" },
                )
                .toPromise();

              if (queryResult.error) {
                throw new Error(queryResult.error.message);
              }

              const data = queryResult.data as any;
              const page: any[] =
                (list === "invoices" ? data?.invoices : data?.smartInvoices) ||
                [];
              rows.push(...page);
              more = page.length === ADMIN_PAGE_SIZE;
              if (page.length > 0) lastId = page[page.length - 1].id;
            }

            return rows;
          };

          const [rawInvoices, rawIntermediatedInvoices] = await Promise.all([
            fetchPagedList("invoices"),
            fetchPagedList("smartInvoices"),
          ]);
          // Admin actions disabled: the AdminAction entity was dropped in the
          // subgraph's event-log migration. TODO: rebuild from InvoiceEvent.
          const rawAdminActions: any[] = [];

          for (const raw of rawInvoices) {
            const list = flattenInvoiceEvents(raw);
            invoices[invoices.length] = {
              id: getDisplayInvoiceIdString(list),
              invoiceId: getContractInvoiceIdBigInt(list),
              contract: list.contract || "",
              seller: list.seller?.id || "",
              payment: list.paymentTxHash || "",
              createdAt: unixToGMT(list.createdAt) || "-",
              paidAt: unixToGMT(list.paidAt),
              by: list.buyer?.id || "",
              release:
                list.releasedAt && !isNaN(list.releasedAt)
                  ? unixToGMT(list.releasedAt)
                  : "Pending",
              fee: list.fee ? formatEther(BigInt(list.fee)) : "0",
              releaseHash: list.releaseHash,
              status: sortState(list.state, list.expiresAt),
              creationTxHash: list.creationTxHash,
              commisionTxHash: list.commisionTxHash,
              refundTxHash: list.refundTxHash,
            };
          }

          for (const list of rawAdminActions) {
            actions[actions.length] = {
              id: getDisplayInvoiceIdString(list),
              invoiceId: getContractInvoiceIdBigInt(list),
              action: list.action || "Unknown",
              time: list.time ? unixToGMT(list.time) : null,
              type: list.type,
              txHash: list.txHash,
              balance: list.balance ? formatEther(BigInt(list.balance)) : "0",
            };
          }

          for (const raw of rawIntermediatedInvoices) {
            const list = flattenInvoiceEvents(raw);
            intermediatedInvoices[intermediatedInvoices.length] = {
              id: getDisplayInvoiceIdString(list),
              invoiceId: getContractInvoiceIdBigInt(list),
              contract: list.contract || "",
              seller: list.seller?.id || "",
              payment: list.paymentTxHash || "",
              createdAt: unixToGMT(list.createdAt) || "-",
              paidAt: unixToGMT(list.paidAt),
              by: list.buyer?.id || "",
              release:
                list.releasedAt && !isNaN(list.releasedAt)
                  ? unixToGMT(list.releasedAt)
                  : "Pending",
              fee: list.fee ? formatEther(BigInt(list.fee)) : "0",
              state: list.state,
              releaseHash: list.releaseHash,
              status: sortState(list.state),
              creationTxHash: list.creationTxHash,
              commisionTxHash: list.commisionTxHash,
              refundTxHash: list.refundTxHash,
            };
          }

          const result = { invoices, actions, intermediatedInvoices };
          allInvoiceDataCacheRef.current = {
            chainId,
            timestamp: Date.now(),
            data: result,
          };
          return result;
        } catch (error) {
          console.error("Error fetching invoice data:", error);
          if (
            typeof error === "object" &&
            error !== null &&
            "message" in error
          ) {
            handleRateLimit((error as any).message);
          }
          return allInvoiceDataRef.current;
        } finally {
          allInvoiceDataInflightRef.current = null;
        }
      })();

      allInvoiceDataInflightRef.current = request;
      return request;
    },
    [chainId, handleRateLimit],
  );

  const getInvoiceOwner = useCallback(
    async (id: string): Promise<string> => {
      if (Date.now() < nextAllowedRequestRef.current) {
        return "";
      }

      const { data, error } = await client(chainId)
        .query(invoiceOwnerQuery, { id })
        .toPromise();

      if (error) {
        console.error("GraphQL Error:", error.message);
        handleRateLimit(error.message);
        return "";
      }

      return data?.invoice?.seller?.id || "";
    },
    [chainId, handleRateLimit],
  );

  const getIntermediatedInvoiceData = useCallback(
    async (
      invoiceId: bigint,
      type: "smartInvoice" | "metaInvoice",
    ): Promise<any> => {
      if (Date.now() < nextAllowedRequestRef.current) {
        return "";
      }

      const { data, error } = await client(chainId)
        .query(CHECKOUT_QUERIES[type], { id: invoiceId.toString() })
        .toPromise();

      if (error) {
        console.error(`[GraphQL Error] ${type}:`, error.message);
        handleRateLimit(error.message);
        return "";
      }

      return data || "";
    },
    [chainId, handleRateLimit],
  );

  const refreshAdminData = useCallback(
    async (force = false) => {
      const fetchedInvoices = await getAllInvoiceData(force);
      setAllInvoiceData(fetchedInvoices);
    },
    [getAllInvoiceData],
  );

  const readSimpleInvoiceChainData = useCallback(
    async (invoiceId: bigint) => {
      if (!publicClient) return undefined;
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return undefined;

      const key = `${chainId}:${contractAddress}:${invoiceId.toString()}`;
      const cached = simpleInvoiceReadCache.get(key);
      if (cached) return cached.data;

      const existing = simpleInvoiceReadInflight.get(key);
      if (existing) return existing;

      const request = publicClient
        .readContract({
          address: contractAddress,
          abi: paymentProcessor,
          functionName: "getInvoiceData",
          args: [invoiceId],
        })
        .then((data) => {
          simpleInvoiceReadCache.set(key, { data });
          return data;
        })
        .finally(() => {
          simpleInvoiceReadInflight.delete(key);
        });

      simpleInvoiceReadInflight.set(key, request);
      return request;
    },
    [chainId, publicClient],
  );

  const readIntermediatedInvoiceChainData = useCallback(
    async (invoiceId: bigint) => {
      if (!publicClient) return undefined;
      const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return undefined;

      const key = `${chainId}:${contractAddress}:${invoiceId.toString()}`;
      const cached = intermediatedInvoiceReadCache.get(key);
      if (cached) return cached.data;

      const existing = intermediatedInvoiceReadInflight.get(key);
      if (existing) return existing;

      const request = publicClient
        .readContract({
          address: contractAddress,
          abi: intermediatedPaymentProcessor,
          functionName: "getInvoice",
          args: [invoiceId],
        })
        .then((data) => {
          intermediatedInvoiceReadCache.set(key, { data });
          return data;
        })
        .finally(() => {
          intermediatedInvoiceReadInflight.delete(key);
        });

      intermediatedInvoiceReadInflight.set(key, request);
      return request;
    },
    [chainId, publicClient],
  );

  const updateSimpleInvoiceTiming = useCallback(
    async (invoiceId: bigint) => {
      if (!publicClient) return;
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return;

      try {
        const data = await readSimpleInvoiceChainData(invoiceId);
        if (!data) return;

        const invoiceData = data as unknown;
        const invoiceArray = Array.isArray(invoiceData)
          ? (invoiceData as readonly unknown[])
          : null;
        const invoiceObject =
          invoiceData && typeof invoiceData === "object"
            ? (invoiceData as {
                paidAt?: bigint | number;
                releaseAt?: bigint | number;
                sellerActionDeadline?: bigint | number;
                expiresAt?: bigint | number;
              })
            : null;

        const readBigInt = (value: bigint | number | undefined) => {
          if (typeof value === "bigint") return value;
          if (typeof value === "number") return BigInt(value);
          return undefined;
        };

        const paidAt = invoiceObject
          ? readBigInt(invoiceObject.paidAt)
          : readBigInt(invoiceArray?.[2] as bigint | number | undefined);
        const releaseAt = invoiceObject
          ? readBigInt(invoiceObject.releaseAt)
          : readBigInt(invoiceArray?.[3] as bigint | number | undefined);
        const expiresAt = invoiceObject
          ? readBigInt(invoiceObject.expiresAt)
          : readBigInt(invoiceArray?.[4] as bigint | number | undefined);
        const sellerActionDeadline = invoiceObject
          ? readBigInt(invoiceObject.sellerActionDeadline)
          : readBigInt(invoiceArray?.[5] as bigint | number | undefined);

        // Pure per-invoice patch so it can be applied both inside the state
        // updater and against the ref snapshot for the live publish below —
        // state updaters must stay side-effect free.
        const matchesInvoice = (inv: Invoice) =>
          inv.invoiceId.toString() === invoiceId.toString();
        const applyTiming = (inv: Invoice): Invoice => ({
          ...inv,
          status: inv.status === "PAID" ? "ACCEPTED" : inv.status,
          paidAt:
            inv.paidAt && inv.paidAt !== "Not Paid"
              ? inv.paidAt
              : paidAt
                ? paidAt.toString()
                : inv.paidAt,
          releaseAt: releaseAt ? releaseAt.toString() : inv.releaseAt,
          expiresAt: expiresAt
            ? expiresAt.toString()
            : inv.expiresAt,
          sellerActionDeadline: sellerActionDeadline ? sellerActionDeadline.toString() : inv.sellerActionDeadline,
        });

        setInvoiceData((prev) =>
          prev.map((inv) => (matchesInvoice(inv) ? applyTiming(inv) : inv)),
        );

        const liveUpdates = invoiceDataStateRef.current
          .filter(matchesInvoice)
          .map(applyTiming);
        if (liveUpdates.length > 0) {
          publishLiveInvoices(liveUpdates);
        }
      } catch (error) {
        console.error("Failed to read invoice timing", error);
      }
    },
    [chainId, publicClient, publishLiveInvoices, readSimpleInvoiceChainData],
  );

  const hydrateSimpleInvoiceFromChain = useCallback(
    async (inv: bigint, txHash?: string, eventStatus?: Invoice["status"]) => {
      if (!publicClient || !address) return;
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return;

      try {
        const data = await readSimpleInvoiceChainData(inv);
        if (!data) return;

        const invoiceData = data as unknown;
        const invoiceArray = Array.isArray(invoiceData)
          ? (invoiceData as readonly unknown[])
          : null;
        const invoiceObject =
          invoiceData && typeof invoiceData === "object"
            ? (invoiceData as {
                invoiceId?: bigint | number;
                invoiceNonce?: bigint | number;
                createdAt?: bigint | number;
                paidAt?: bigint | number;
                releaseAt?: bigint | number;
                expiresAt?: bigint | number;
                sellerActionDeadline?: bigint | number;
                seller?: string;
                buyer?: string;
                price?: bigint | number;
                balance?: bigint | number;
              })
            : null;

        const readBigInt = (value: bigint | number | undefined) => {
          if (typeof value === "bigint") return value;
          if (typeof value === "number") return BigInt(value);
          return undefined;
        };

        const readString = (value: unknown) =>
          typeof value === "string" ? value : undefined;

        const invoiceNonce = readBigInt(
          invoiceObject?.invoiceNonce ??
            (invoiceArray?.[0] as bigint | number | undefined),
        );
        const createdAt = readBigInt(
          invoiceObject?.createdAt ??
            (invoiceArray?.[1] as bigint | number | undefined),
        );
        const paidAt = readBigInt(
          invoiceObject?.paidAt ??
            (invoiceArray?.[2] as bigint | number | undefined),
        );
        const releaseAt = readBigInt(
          invoiceObject?.releaseAt ??
            (invoiceArray?.[3] as bigint | number | undefined),
        );
        const expiresAt = readBigInt(
          invoiceObject?.expiresAt ??
            (invoiceArray?.[4] as bigint | number | undefined),
        );
        const sellerActionDeadline = readBigInt(
          invoiceObject?.sellerActionDeadline ??
            (invoiceArray?.[5] as bigint | number | undefined),
        );
        const seller = readString(invoiceObject?.seller ?? invoiceArray?.[8]);
        const buyer = readString(invoiceObject?.buyer ?? invoiceArray?.[9]);
        const price = readBigInt(
          invoiceObject?.price ??
            (invoiceArray?.[11] as bigint | number | undefined),
        );
        const amountPaid = readBigInt(
          invoiceObject?.balance ??
            (invoiceArray?.[12] as bigint | number | undefined),
        );

        const normalizedAddress = address.toLowerCase();
        const isSeller =
          typeof seller === "string" &&
          seller.toLowerCase() === normalizedAddress;
        const isBuyer =
          typeof buyer === "string" &&
          buyer.toLowerCase() === normalizedAddress;

        if (!isSeller && !isBuyer) return;

        const resolvedInvoiceId = inv;

        // Status comes from the event that triggered this hydration when we
        // have it; otherwise infer from the contract's paidAt so an invoice
        // hydrated off a refund/release event doesn't get stamped "PAID".
        const isPaid = paidAt !== undefined && paidAt > BigInt(0);
        const status: Invoice["status"] =
          eventStatus ?? (isPaid ? "PAID" : "AWAITING PAYMENT");

        let history = createdAt
          ? appendHistoryEntry(undefined, "CREATED", createdAt.toString())
          : undefined;
        if (isPaid) {
          history = appendHistoryEntry(history, "PAID", paidAt.toString());
        }
        history = appendHistoryEntry(history, status, nowInSeconds());

        const nextInvoice: Invoice = {
          id: invoiceNonce
            ? invoiceNonce.toString()
            : resolvedInvoiceId.toString(),
          invoiceId: resolvedInvoiceId,
          createdAt: createdAt ? unixToGMT(Number(createdAt)) : null,
          paidAt: isPaid ? paidAt.toString() : "Not Paid",
          status,
          price: price ? formatEther(price) : null,
          amountPaid: amountPaid ? formatEther(amountPaid) : "0",
          type: isSeller ? "Seller" : "Buyer",
          contract: contractAddress,
          buyer: buyer ?? "",
          seller: seller ?? "",
          source: "Simple",
          paymentTxHash: status === "PAID" ? txHash : undefined,
          refundTxHash: status === "REFUNDED" ? txHash : undefined,
          releaseHash: status === "RELEASED" ? txHash : undefined,
          releaseAt: releaseAt ? releaseAt.toString() : undefined,
          expiresAt: expiresAt ? expiresAt.toString() : undefined,
          sellerActionDeadline: sellerActionDeadline ? sellerActionDeadline.toString() : undefined,
          history,
        };

        setInvoiceData((prev) => {
          const exists = prev.some(
            (inv) => inv.invoiceId.toString() === resolvedInvoiceId.toString(),
          );

          if (!exists) {
            return [nextInvoice, ...prev];
          }

          return prev.map((inv) => {
            if (inv.invoiceId.toString() !== resolvedInvoiceId.toString())
              return inv;

            return {
              ...inv,
              ...nextInvoice,
              status: pickNewerStatus(
                inv.status ?? "",
                nextInvoice.status ?? "",
              ),
              amountPaid: nextInvoice.amountPaid ?? inv.amountPaid,
              paymentTxHash: nextInvoice.paymentTxHash ?? inv.paymentTxHash,
              refundTxHash: nextInvoice.refundTxHash ?? inv.refundTxHash,
              releaseHash: nextInvoice.releaseHash ?? inv.releaseHash,
              releaseAt: nextInvoice.releaseAt || inv.releaseAt,
              expiresAt: nextInvoice.expiresAt || inv.expiresAt,
              sellerActionDeadline: nextInvoice.sellerActionDeadline || inv.sellerActionDeadline,
              buyer: nextInvoice.buyer || inv.buyer,
              seller: nextInvoice.seller || inv.seller,
              price: nextInvoice.price ?? inv.price,
              history: mergeHistory(inv.history, nextInvoice.history),
            };
          });
        });
        publishLiveInvoices([nextInvoice]);
      } catch (error) {
        console.error("Failed to hydrate invoice from chain", error);
      }
    },
    [
      address,
      chainId,
      publicClient,
      publishLiveInvoices,
      readSimpleInvoiceChainData,
    ],
  );

  const hydrateIntermediatedInvoiceFromChain = useCallback(
    async (
      invoiceId: bigint,
      eventStatus?: Invoice["status"],
      txHash?: string,
      eventFields?: Partial<Invoice>,
    ) => {
      if (!publicClient || !address) return;
      const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return;

      try {
        const data = await readIntermediatedInvoiceChainData(invoiceId);
        if (!data) return;

        const invoiceData = data as unknown;
        const invoiceArray = Array.isArray(invoiceData)
          ? (invoiceData as readonly unknown[])
          : null;
        const invoiceObject =
          invoiceData && typeof invoiceData === "object"
            ? (invoiceData as {
                invoiceNonce?: bigint | number;
                paidAt?: bigint | number;
                createdAt?: bigint | number;
                releaseAt?: bigint | number;
                expiresAt?: bigint | number;
                state?: bigint | number;
                buyer?: string;
                seller?: string;
                paymentToken?: string;
                amountPaid?: bigint | number;
                price?: bigint | number;
                balance?: bigint | number;
              })
            : null;

        const readBigInt = (value: bigint | number | undefined) => {
          if (typeof value === "bigint") return value;
          if (typeof value === "number") return BigInt(value);
          return undefined;
        };

        const readString = (value: unknown) =>
          typeof value === "string" ? value : undefined;

        const invoiceNonce = readBigInt(
          invoiceObject?.invoiceNonce ??
            (invoiceArray?.[0] as bigint | number | undefined),
        );
        const paidAt = readBigInt(
          invoiceObject?.paidAt ??
            (invoiceArray?.[1] as bigint | number | undefined),
        );
        const createdAt = readBigInt(
          invoiceObject?.createdAt ??
            (invoiceArray?.[2] as bigint | number | undefined),
        );
        const releaseAt = readBigInt(
          invoiceObject?.releaseAt ??
            (invoiceArray?.[3] as bigint | number | undefined),
        );
        const expiresAt = readBigInt(
          invoiceObject?.expiresAt ??
            (invoiceArray?.[4] as bigint | number | undefined),
        );
        const state = readBigInt(
          invoiceObject?.state ??
            (invoiceArray?.[5] as bigint | number | undefined),
        );
        const buyer = readString(invoiceObject?.buyer ?? invoiceArray?.[9]);
        const seller = readString(invoiceObject?.seller ?? invoiceArray?.[10]);
        const paymentToken = readString(
          invoiceObject?.paymentToken ?? invoiceArray?.[12],
        );
        const amountPaid = readBigInt(
          invoiceObject?.amountPaid ??
            (invoiceArray?.[13] as bigint | number | undefined),
        );
        const price = readBigInt(
          invoiceObject?.price ??
            (invoiceArray?.[14] as bigint | number | undefined),
        );
        const balance = readBigInt(
          invoiceObject?.balance ??
            (invoiceArray?.[15] as bigint | number | undefined),
        );

        if (!state || state === BigInt(0)) return;

        const normalizedAddress = address.toLowerCase();
        const isSeller =
          typeof seller === "string" &&
          seller.toLowerCase() === normalizedAddress;
        const isBuyer =
          typeof buyer === "string" &&
          buyer.toLowerCase() === normalizedAddress;

        if (!isSeller && !isBuyer) return;

        const rawState = INTERMEDIATED_STATE_LABELS[Number(state)] ?? "";
        const status = eventStatus ?? sortState(rawState);
        const paidTimestamp =
          paidAt && paidAt > BigInt(0) ? paidAt.toString() : undefined;
        const historyTime = eventStatus
          ? nowInSeconds()
          : paidTimestamp ?? createdAt?.toString();
        const initialHistory = createdAt
          ? [{ status: "CREATED", time: createdAt.toString() }]
          : undefined;

        const nextInvoice: Invoice = {
          id: invoiceNonce ? invoiceNonce.toString() : invoiceId.toString(),
          invoiceId,
          createdAt: createdAt ? unixToGMT(Number(createdAt)) : null,
          paidAt: paidTimestamp ?? "Not Paid",
          status,
          price: price ? price.toString() : null,
          amountPaid:
            amountPaid && amountPaid > BigInt(0)
              ? amountPaid.toString()
              : balance
                ? balance.toString()
                : "0",
          type: isSeller ? "IssuedInvoice" : "ReceivedInvoice",
          contract: contractAddress,
          buyer: buyer ?? "",
          seller: seller ?? "",
          source: "Intermediated",
          paymentToken: paymentToken ?? "",
          paymentTxHash: status === "PAID" ? txHash : undefined,
          refundTxHash: status === "REFUNDED" ? txHash : undefined,
          releaseHash: status === "RELEASED" ? txHash : undefined,
          disputeSettledTxHash:
            status === "DISPUTE_SETTLED" ? txHash : undefined,
          releaseAt: releaseAt ? releaseAt.toString() : undefined,
          expiresAt: expiresAt ? expiresAt.toString() : undefined,
          history: appendHistoryEntry(initialHistory, status, historyTime),
          ...eventFields,
        };

        setInvoiceData((prev) => {
          const mergedByKey = new Map<string, Invoice>(
            prev.map((inv) => [getInvoiceMergeKey(inv), inv]),
          );
          const key = getInvoiceMergeKey(nextInvoice);
          const existing = mergedByKey.get(key);

          if (!existing) {
            mergedByKey.set(key, nextInvoice);
          } else {
            mergedByKey.set(key, {
              ...existing,
              ...nextInvoice,
              status: pickNewerStatus(
                existing.status ?? "",
                nextInvoice.status ?? "",
              ),
              paymentTxHash:
                nextInvoice.paymentTxHash ?? existing.paymentTxHash,
              refundTxHash: nextInvoice.refundTxHash ?? existing.refundTxHash,
              releaseHash: nextInvoice.releaseHash ?? existing.releaseHash,
              disputeSettledTxHash:
                nextInvoice.disputeSettledTxHash ??
                existing.disputeSettledTxHash,
              releaseAt: nextInvoice.releaseAt || existing.releaseAt,
              expiresAt: nextInvoice.expiresAt || existing.expiresAt,
              buyer: nextInvoice.buyer || existing.buyer,
              seller: nextInvoice.seller || existing.seller,
              paymentToken: nextInvoice.paymentToken || existing.paymentToken,
              price: nextInvoice.price ?? existing.price,
              amountPaid: nextInvoice.amountPaid ?? existing.amountPaid,
              history: mergeHistory(existing.history, nextInvoice.history),
            });
          }

          return Array.from(mergedByKey.values()).sort(
            compareInvoicesByLastActionDesc,
          );
        });
        publishLiveInvoices([nextInvoice]);
      } catch (error) {
        console.error("Failed to hydrate intermediated invoice from chain", error);
      }
    },
    [
      address,
      chainId,
      publicClient,
      publishLiveInvoices,
      readIntermediatedInvoiceChainData,
    ],
  );

  const watchInvoiceEvents = useCallback((tab: InvoiceEventTab) => {
    const id = ++eventWatchIdRef.current;
    setEventWatches((prev) => [...prev, { id, tab }]);
    return () => {
      setEventWatches((prev) => prev.filter((watch) => watch.id !== id));
    };
  }, []);

  const trackInvoices = useCallback((invoices: Invoice[]) => {
    const lists = trackedInvoiceListsRef.current;
    lists.add(invoices);
    return () => {
      lists.delete(invoices);
    };
  }, []);

  const watchInvoiceStatus = useCallback(
    (invoiceId: bigint, listener: (status: Invoice["status"]) => void) => {
      const key = invoiceId.toString();
      const listeners = invoiceStatusListenersRef.current;
      const forInvoice = listeners.get(key) ?? new Set();
      forInvoice.add(listener);
      listeners.set(key, forInvoice);
      return () => {
        forInvoice.delete(listener);
        if (forInvoice.size === 0 && listeners.get(key) === forInvoice) {
          listeners.delete(key);
        }
      };
    },
    [],
  );

  const notifyInvoiceStatus = useCallback(
    (invoiceId: string, status: Invoice["status"]) => {
      invoiceStatusListenersRef.current
        .get(invoiceId)
        ?.forEach((listener) => listener(status));
    },
    [],
  );

  const findTrackedInvoice = useCallback(
    (invoiceId: string, source: "Simple" | "Intermediated") => {
      for (const list of trackedInvoiceListsRef.current) {
        for (const invoice of list) {
          if (matchesInvoiceIdentity(invoice, invoiceId, source)) {
            return invoice;
          }
        }
      }
      return undefined;
    },
    [],
  );

  // Seed from storage on address or chain change
  useEffect(() => {
    if (!address) {
      setInvoiceData([]);
      setAllInvoiceData({
        invoices: [],
        actions: [],
        intermediatedInvoices: [],
      });
      setLiveInvoiceData([]);
      return;
    }

    setLiveInvoiceData([]);
    // Replace even when nothing is stored: keeping the previous account's
    // invoices would show them under this one and persist them for it.
    const cachedInvoices = readInvoiceCache(cacheKey);
    lastCacheWriteSignatureRef.current =
      getInvoiceCacheSignature(cachedInvoices);
    setInvoiceData(cachedInvoices);

    // No network fetch: the dashboard renders its own paged query, event
    // watchers stream changes into invoiceData, and the pay page reads the
    // invoice from the chain when it is not here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId]);

  useSimpleInvoiceEvents({
    active: activeEventTab === "simple" && isWindowVisible,
    address,
    chainId,
    publicClient,
    invoicesRef: invoiceDataStateRef,
    setInvoiceData,
    findTrackedInvoice,
    updateSimpleInvoiceTiming,
    hydrateSimpleInvoiceFromChain,
    onLiveInvoices: publishLiveInvoices,
    onInvoiceStatus: notifyInvoiceStatus,
  });

  useIntermediatedInvoiceEvents({
    active: activeEventTab === "intermediated" && isWindowVisible,
    address,
    chainId,
    publicClient,
    invoicesRef: invoiceDataStateRef,
    setInvoiceData,
    findTrackedInvoice,
    onLiveInvoices: publishLiveInvoices,
    hydrateIntermediatedInvoiceFromChain,
  });

  return useMemo(
    () => ({
      invoiceData,
      liveInvoiceData,
      allInvoiceData,
      getInvoiceOwner,
      getIntermediatedInvoiceData,
      addCreatedSimpleInvoice,
      upsertLocalInvoice,
      watchInvoiceEvents,
      watchInvoiceStatus,
      trackInvoices,
      refreshAdminData,
    }),
    [
      invoiceData,
      liveInvoiceData,
      allInvoiceData,
      getInvoiceOwner,
      getIntermediatedInvoiceData,
      addCreatedSimpleInvoice,
      upsertLocalInvoice,
      watchInvoiceEvents,
      watchInvoiceStatus,
      trackInvoices,
      refreshAdminData,
    ],
  );
};
