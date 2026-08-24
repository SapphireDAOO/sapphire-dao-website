/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { LRUCache } from "lru-cache";
import {
  GET_ALL_INVOICES,
  invoiceQuery,
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
  ZERO_ADDRESS,
} from "@/constants";
import {
  AllInvoice,
  AdminAction,
  UserCreatedInvoice,
  UserPaidInvoice,
  UserIssuedInvoiceInvoice,
  UserReceivedInvoicesInvoice,
  AllInvoicesData,
  Invoice,
} from "@/model/model";

import { formatEther } from "viem";
import { client } from "@/services/graphql/client";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import {
  sortState,
  sortHistory,
  synthesizeMarketplaceHistory,
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
} from "@/lib/invoiceIdentifiers";
import { useSimpleInvoiceEvents } from "./useSimpleInvoiceEvents";
import { useMarketplaceInvoiceEvents } from "./useMarketplaceInvoiceEvents";
import { useIsWindowVisible } from "./useIsWindowVisible";
import type { CreatedSimpleInvoice } from "@/services/blockchain/SimplePaymentProcessor";

const ERROR_BACKOFF_MS = 15_000;
const PAGE_SIZE = 24;
const ADMIN_INVOICE_CACHE_TTL_MS = 5_000;
const USER_INVOICE_PAGE_CACHE_TTL_MS = 2_000;
const USER_INVOICE_PAGE_CACHE_MAX = 100;
const LIVE_INVOICE_OVERLAY_LIMIT = 100;
const SIMPLE_INVOICE_READ_TTL_MS = 5_000;
const MARKETPLACE_INVOICE_READ_TTL_MS = 5_000;

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

// seperate the contents of this file. admin cache should be different from users
// caching in here might not be neccessary
// paginate data from subgraph, when it is exhausted, make another query
// use cache first in query
type UserInvoicePageResult = {
  data?: any;
  error?: any;
};

const userInvoicePageCache = new LRUCache<string, UserInvoicePageResult>({
  max: USER_INVOICE_PAGE_CACHE_MAX,
  ttl: USER_INVOICE_PAGE_CACHE_TTL_MS,
});
const userInvoicePageInflight = new Map<
  string,
  Promise<UserInvoicePageResult>
>();

const getCachedUserInvoicePage = (
  key: string,
): UserInvoicePageResult | null => {
  return userInvoicePageCache.get(key) ?? null;
};

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
    marketplaceInvoices: [],
  });

  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastCacheWriteSignatureRef = useRef("");

  const [invoicePage, setInvoicePage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [activeEventTab, setActiveEventTab] = useState<
    "simple" | "marketplace"
  >("simple");
  const currentPageRef = useRef(0);
  const invoiceDataLengthRef = useRef(0);
  const isWindowVisible = useIsWindowVisible();

  const isFetchingRef = useRef(false);
  const nextAllowedRequestRef = useRef<number>(0);
  const hasFetchedRef = useRef(false);
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
    marketplaceInvoices: [],
  });
  const allInvoiceDataCacheRef = useRef<{
    chainId: number;
    timestamp: number;
    data: AllInvoicesData;
  } | null>(null);
  const allInvoiceDataInflightRef = useRef<Promise<AllInvoicesData> | null>(
    null,
  );
  const simpleInvoiceReadCacheRef = useRef<
    Map<string, { timestamp: number; data: unknown }>
  >(new Map());
  const simpleInvoiceReadInflightRef = useRef<Map<string, Promise<unknown>>>(
    new Map(),
  );
  const marketplaceInvoiceReadCacheRef = useRef<
    Map<string, { timestamp: number; data: unknown }>
  >(new Map());
  const marketplaceInvoiceReadInflightRef = useRef<
    Map<string, Promise<unknown>>
  >(new Map());
  useEffect(() => {
    allInvoiceDataRef.current = allInvoiceData;
  }, [allInvoiceData]);

  const invoiceDataStateRef = useRef<Invoice[]>([]);
  useEffect(() => {
    invoiceDataStateRef.current = invoiceData;
    invoiceDataLengthRef.current = invoiceData.length;
  }, [invoiceData]);

  useEffect(() => {
    if (!cacheKey) return;
    if (!hasFetchedRef.current && invoiceData.length === 0) return;
    const signature = getInvoiceCacheSignature(invoiceData);
    if (signature === lastCacheWriteSignatureRef.current) return;
    if (cacheWriteTimeoutRef.current)
      clearTimeout(cacheWriteTimeoutRef.current);
    cacheWriteTimeoutRef.current = setTimeout(() => {
      lastCacheWriteSignatureRef.current = signature;
      writeInvoiceCache(cacheKey, invoiceData);
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
      if (!hasFetchedRef.current && invoiceData.length === 0) return;
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
        cacheWriteTimeoutRef.current = null;
      }

      const signature = getInvoiceCacheSignature(invoiceData);
      if (signature === lastCacheWriteSignatureRef.current) return;

      lastCacheWriteSignatureRef.current = signature;
      writeInvoiceCache(cacheKey, invoiceData);
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
        const marketplaceInvoices: AllInvoice[] = [];

        try {
          // Page through each list until exhausted; the subgraph caps a single
          // request at PAGE_SIZE, so a one-shot query would silently drop
          // anything past the first page. Each list pages sequentially, but
          // the lists run in parallel so total latency is the longest list,
          // not the sum of all of them.
          const fetchPagedList = async (
            list: "invoices" | "smartInvoices",
          ): Promise<any[]> => {
            const rows: any[] = [];
            let skip = 0;
            let more = true;

            while (more) {
              const queryResult = await client(chainId)
                .query(
                  GET_ALL_INVOICES,
                  {
                    skipInvoices: skip,
                    firstInvoices: PAGE_SIZE,
                    includeInvoices: list === "invoices",
                    skipActions: 0,
                    firstActions: PAGE_SIZE,
                    includeActions: false,
                    skipSmartInvoices: skip,
                    firstSmartInvoices: PAGE_SIZE,
                    includeSmartInvoices: list === "smartInvoices",
                  },
                  force ? { requestPolicy: "network-only" } : undefined,
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
              more = page.length === PAGE_SIZE;
              skip += page.length;
            }

            return rows;
          };

          const [rawInvoices, rawMarketplaceInvoices] = await Promise.all([
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

          for (const raw of rawMarketplaceInvoices) {
            const list = flattenInvoiceEvents(raw);
            marketplaceInvoices[marketplaceInvoices.length] = {
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

          const result = { invoices, actions, marketplaceInvoices };
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

  const getInvoiceData = useCallback(
    async (page = 0, force = false) => {
      if (!address) return;

      if (Date.now() < nextAllowedRequestRef.current) {
        return;
      }

      const skip = page * PAGE_SIZE;
      const normalizedAddress = address.toLowerCase();
      const requestKey = `${chainId}:${normalizedAddress}:${PAGE_SIZE}:${skip}`;

      try {
        const cached = force ? null : getCachedUserInvoicePage(requestKey);
        let result: UserInvoicePageResult;

        if (cached) {
          result = cached;
        } else {
          let inflight = force
            ? undefined
            : userInvoicePageInflight.get(requestKey);
          if (!inflight) {
            inflight = client(chainId)
              .query(
                invoiceQuery,
                {
                  address: normalizedAddress,
                  first: PAGE_SIZE,
                  skip,
                },
                force ? { requestPolicy: "network-only" } : undefined,
              )
              .toPromise()
              .then((queryResult) => {
                if (!queryResult.error) {
                  userInvoicePageCache.set(requestKey, queryResult);
                }
                return queryResult;
              })
              .finally(() => {
                userInvoicePageInflight.delete(requestKey);
              });

            if (!force) {
              userInvoicePageInflight.set(requestKey, inflight);
            }
          }

          result = await inflight;
        }

        const { data, error } = result;

        if (error) {
          console.error("GraphQL error fetching user invoices:", error.message);
          handleRateLimit(error.message);
          return;
        }

        if (!data?.user) return;

        // The subgraph now exposes invoice history via an `events` relation;
        // flatten it back into the legacy flat fields the mappings below read.
        const createdInvoice: any[] = (data.user.ownedSimpleInvoices || []).map(
          flattenInvoiceEvents,
        );
        const paidInvoices: any[] = (data.user.paidSimpleInvoices || []).map(
          flattenInvoiceEvents,
        );
        const issuedInvoices: any[] = (
          data.user.issuedAdvancedInvoices || []
        ).map(flattenInvoiceEvents);
        const receivedInvoices: any[] = (
          data.user.receivedAdvancedInvoices || []
        ).map(flattenInvoiceEvents);

        const createdInvoiceData = createdInvoice.map((invoice: any) => ({
          id: getDisplayInvoiceIdString(invoice),
          invoiceId: getContractInvoiceIdBigInt(invoice),
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: sortState(invoice.state, invoice.expiresAt),
          price: invoice.price ? formatEther(BigInt(invoice.price)) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(BigInt(invoice.amountPaid))
            : null,
          type: "Seller" as const,
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          expiresAt: invoice.expiresAt,
          sellerActionDeadline: invoice.sellerActionDeadline,
          seller: invoice.seller?.id ?? "",
          buyer: invoice.buyer?.id ?? "",
          releaseHash: invoice.releaseHash,
          releaseAt: invoice.releasedAt,
          source: "Simple" as const,
          history: sortHistory(invoice.history, invoice.historyTime),
          refundTxHash: invoice.refundTxHash,
        }));

        const paidInvoiceData = paidInvoices.map((invoice: any) => ({
          id: getDisplayInvoiceIdString(invoice),
          invoiceId: getContractInvoiceIdBigInt(invoice),
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: sortState(invoice.state, invoice.expiresAt),
          price: invoice.price ? formatEther(BigInt(invoice.price)) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(BigInt(invoice.amountPaid))
            : null,
          type: "Buyer" as const,
          seller: invoice.seller?.id ?? "",
          contract: invoice.contract,
          expiresAt: invoice.expiresAt,
          sellerActionDeadline: invoice.sellerActionDeadline,
          paymentTxHash: invoice.paymentTxHash,
          releaseAt: invoice.releasedAt,
          buyer: invoice.buyer?.id ?? "",
          source: "Simple" as const,
          history: sortHistory(invoice.history, invoice.historyTime),
          refundTxHash: invoice.refundTxHash,
        }));

        const mapMarketplaceInvoice = (
          invoice: any,
          type: "IssuedInvoice" | "ReceivedInvoice",
        ) => ({
          id: getDisplayInvoiceIdString(invoice),
          invoiceId: getContractInvoiceIdBigInt(invoice),
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: sortState(invoice.state),
          price: invoice.price ?? null,
          // Pass raw string so the component can format with correct token decimals
          amountPaid:
            invoice.amountPaid != null ? String(invoice.amountPaid) : null,
          amountReleased:
            invoice.amountReleased != null
              ? String(invoice.amountReleased)
              : null,
          amountRefunded:
            invoice.amountRefunded != null
              ? String(invoice.amountRefunded)
              : null,
          disputeSettledTxHash: invoice.disputeSettledTxHash,
          sellerAmountReceivedAfterDispute:
            invoice.sellerAmountReceivedAfterDispute ?? null,
          buyerAmountReceivedAfterDispute:
            invoice.buyerAmountReceivedAfterDispute ?? null,
          type,
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          seller: invoice.seller?.id ?? "",
          releaseHash: invoice.releaseHash,
          releaseAt: invoice.releasedAt,
          buyer: invoice.buyer?.id ?? "",
          source: "Marketplace" as const,
          // Native ETH has no PaymentToken entity in the subgraph — normalize to the
          // zero address so downstream lookups (decimals, symbol) match correctly.
          paymentToken: invoice.paymentToken?.id ?? ZERO_ADDRESS,
          cancelAt: invoice.cancelAt,
          refundTxHash: invoice.refundTxHash,
          history: synthesizeMarketplaceHistory(invoice),
        });

        const issuedInvoicesData = issuedInvoices.map(
          (inv: any) =>
            mapMarketplaceInvoice(
              inv,
              "IssuedInvoice",
            ) as UserIssuedInvoiceInvoice,
        );
        const receivedInvoicesData = receivedInvoices.map(
          (inv: any) =>
            mapMarketplaceInvoice(
              inv,
              "ReceivedInvoice",
            ) as UserReceivedInvoicesInvoice,
        );

        const allInvoiceDataCombined: (
          | UserCreatedInvoice
          | UserPaidInvoice
          | UserReceivedInvoicesInvoice
          | UserIssuedInvoiceInvoice
        )[] = [
          ...createdInvoiceData,
          ...paidInvoiceData,
          ...issuedInvoicesData,
          ...receivedInvoicesData,
        ];

        const moreAvailable =
          createdInvoice.length === PAGE_SIZE ||
          paidInvoices.length === PAGE_SIZE ||
          issuedInvoices.length === PAGE_SIZE ||
          receivedInvoices.length === PAGE_SIZE;

        setInvoiceData((prev) => {
          // Seed the merge map with ALL in-memory invoices (not just the current
          // page). This ensures event-created invoices that haven't yet been indexed
          // by the subgraph survive subsequent getInvoiceData calls. Subgraph results
          // for the current page then overlay and update these entries below.
          const mergedByKey = new Map<string, Invoice>(
            prev.map((inv) => [getInvoiceMergeKey(inv), inv]),
          );

          allInvoiceDataCombined.forEach((inv) => {
            const key = getInvoiceMergeKey(inv);
            const existing = mergedByKey.get(key);
            if (!existing) {
              mergedByKey.set(key, inv as Invoice);
              return;
            }

            mergedByKey.set(key, {
              ...existing,
              ...inv,
              amountPaid:
                inv.amountPaid && inv.amountPaid !== "0"
                  ? inv.amountPaid
                  : existing.amountPaid,
              paidAt:
                inv.paidAt && inv.paidAt !== "Not Paid"
                  ? inv.paidAt
                  : existing.paidAt,
              paymentTxHash: inv.paymentTxHash || existing.paymentTxHash,
              refundTxHash: inv.refundTxHash || existing.refundTxHash,
              // Prefer the in-memory releaseAt (set by updateSimpleInvoiceTiming from
              // the contract). The subgraph field mapped here is actually `releasedAt`
              // (past event timestamp, "0" until released) — "0" is truthy as a string
              // so `inv.releaseAt || existing` would incorrectly discard the valid
              // contract-read hold-period timestamp and break the release countdown.
              releaseAt:
                Number(existing.releaseAt) > 0
                  ? existing.releaseAt
                  : Number(inv.releaseAt) > 0
                    ? inv.releaseAt
                    : undefined,
              sellerActionDeadline: inv.sellerActionDeadline || existing.sellerActionDeadline,
              buyer: inv.buyer || existing.buyer,
              history: mergeHistory(existing.history, inv.history),
              status: pickNewerStatus(existing.status ?? "", inv.status ?? ""),
            } as Invoice);
          });

          return Array.from(mergedByKey.values()).sort(
            compareInvoicesByLastActionDesc,
          );
        });
        setHasNextPage(moreAvailable);
        setInvoicePage(page);
        currentPageRef.current = page;
        hasFetchedRef.current = true;
      } catch (error) {
        console.error("Error fetching invoice data:", error);
        if (typeof error === "object" && error !== null && "message" in error) {
          handleRateLimit((error as any).message);
        }
      }
    },
    [address, chainId, handleRateLimit],
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

  const refetchAllInvoiceData = useCallback(
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
      const cached = simpleInvoiceReadCacheRef.current.get(key);
      if (
        cached &&
        Date.now() - cached.timestamp < SIMPLE_INVOICE_READ_TTL_MS
      ) {
        return cached.data;
      }

      const existing = simpleInvoiceReadInflightRef.current.get(key);
      if (existing) return existing;

      const request = publicClient
        .readContract({
          address: contractAddress,
          abi: paymentProcessor,
          functionName: "getInvoiceData",
          args: [invoiceId],
        })
        .then((data) => {
          simpleInvoiceReadCacheRef.current.set(key, {
            timestamp: Date.now(),
            data,
          });
          return data;
        })
        .finally(() => {
          simpleInvoiceReadInflightRef.current.delete(key);
        });

      simpleInvoiceReadInflightRef.current.set(key, request);
      return request;
    },
    [chainId, publicClient],
  );

  const readMarketplaceInvoiceChainData = useCallback(
    async (invoiceId: bigint) => {
      if (!publicClient) return undefined;
      const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return undefined;

      const key = `${chainId}:${contractAddress}:${invoiceId.toString()}`;
      const cached = marketplaceInvoiceReadCacheRef.current.get(key);
      if (
        cached &&
        Date.now() - cached.timestamp < MARKETPLACE_INVOICE_READ_TTL_MS
      ) {
        return cached.data;
      }

      const existing = marketplaceInvoiceReadInflightRef.current.get(key);
      if (existing) return existing;

      const request = publicClient
        .readContract({
          address: contractAddress,
          abi: intermediatedPaymentProcessor,
          functionName: "getInvoice",
          args: [invoiceId],
        })
        .then((data) => {
          marketplaceInvoiceReadCacheRef.current.set(key, {
            timestamp: Date.now(),
            data,
          });
          return data;
        })
        .finally(() => {
          marketplaceInvoiceReadInflightRef.current.delete(key);
        });

      marketplaceInvoiceReadInflightRef.current.set(key, request);
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

  const hydrateMarketplaceInvoiceFromChain = useCallback(
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
        const data = await readMarketplaceInvoiceChainData(invoiceId);
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
          source: "Marketplace",
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
        console.error("Failed to hydrate marketplace invoice from chain", error);
      }
    },
    [
      address,
      chainId,
      publicClient,
      publishLiveInvoices,
      readMarketplaceInvoiceChainData,
    ],
  );

  const fetchLatestInvoices = useCallback(
    async (
      force = false,
      mode: "user" | "admin" | "both" = "user",
    ): Promise<void> => {
      if (isFetchingRef.current && !force) return;

      isFetchingRef.current = true;
      try {
        if (mode === "user" || mode === "both") {
          await getInvoiceData(currentPageRef.current, force);
        }
        if (mode === "admin" || mode === "both") {
          await refetchAllInvoiceData(force);
        }
      } finally {
        isFetchingRef.current = false;
      }
    },
    [getInvoiceData, refetchAllInvoiceData],
  );

  // Initial fetch / address or chain change
  useEffect(() => {
    if (!address) {
      setInvoiceData([]);
      setAllInvoiceData({
        invoices: [],
        actions: [],
        marketplaceInvoices: [],
      });
      setLiveInvoiceData([]);
      return;
    }

    hasFetchedRef.current = false;
    lastCacheWriteSignatureRef.current = "";
    currentPageRef.current = 0;
    setInvoicePage(0);
    setHasNextPage(false);
    setLiveInvoiceData([]);
    const cachedInvoices = readInvoiceCache(cacheKey);
    if (cachedInvoices.length > 0) {
      setInvoiceData(cachedInvoices);
    }

    // No initial network fetch here — IndexRecentPayment runs its own paged
    // query, event watchers stream new invoices into invoiceData, and
    // refetchInvoiceData is invoked after actions complete. The cache above
    // gives an instant render in the meantime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId]);

  useSimpleInvoiceEvents({
    active: activeEventTab === "simple" && isWindowVisible,
    address,
    chainId,
    publicClient,
    invoicesRef: invoiceDataStateRef,
    setInvoiceData,
    updateSimpleInvoiceTiming,
    hydrateSimpleInvoiceFromChain,
    onLiveInvoices: publishLiveInvoices,
  });

  useMarketplaceInvoiceEvents({
    active: activeEventTab === "marketplace" && isWindowVisible,
    address,
    chainId,
    publicClient,
    invoicesRef: invoiceDataStateRef,
    setInvoiceData,
    onLiveInvoices: publishLiveInvoices,
    hydrateMarketplaceInvoiceFromChain,
  });

  // Stable wrappers so the returned object (and any context value built from
  // it) only changes identity when the underlying data actually changes.
  // Default to the same cache-aware behavior as loadNextPage/loadPrevPage;
  // call refetchInvoiceData or pass force=true when a network refresh is needed.
  const getInvoiceDataForPage = useCallback(
    (page?: number, force = false) =>
      getInvoiceData(page ?? currentPageRef.current, force),
    [getInvoiceData],
  );
  const forceRefetchAllInvoiceData = useCallback(async () => {
    const data = await getAllInvoiceData(true);
    setAllInvoiceData(data);
  }, [getAllInvoiceData]);
  const refreshAdminData = useCallback(
    async (force = false) => fetchLatestInvoices(force, "admin"),
    [fetchLatestInvoices],
  );
  const refetchInvoiceData = useCallback(
    () => getInvoiceData(currentPageRef.current, true),
    [getInvoiceData],
  );
  const loadNextPage = useCallback(
    () => getInvoiceData(currentPageRef.current + 1),
    [getInvoiceData],
  );
  const loadPrevPage = useCallback(
    () =>
      currentPageRef.current > 0
        ? getInvoiceData(currentPageRef.current - 1)
        : Promise.resolve(),
    [getInvoiceData],
  );

  return useMemo(
    () => ({
      invoiceData,
      liveInvoiceData,
      allInvoiceData,
      invoicePage,
      hasNextPage,
      getInvoiceData: getInvoiceDataForPage,
      getAllInvoiceData,
      getInvoiceOwner,
      getIntermediatedInvoiceData,
      addCreatedSimpleInvoice,
      upsertLocalInvoice,
      setActiveEventTab,
      refetchAllInvoiceData: forceRefetchAllInvoiceData,
      refreshAdminData,
      refetchInvoiceData,
      loadNextPage,
      loadPrevPage,
    }),
    [
      invoiceData,
      liveInvoiceData,
      allInvoiceData,
      invoicePage,
      hasNextPage,
      getInvoiceDataForPage,
      getAllInvoiceData,
      getInvoiceOwner,
      getIntermediatedInvoiceData,
      addCreatedSimpleInvoice,
      upsertLocalInvoice,
      forceRefetchAllInvoiceData,
      refreshAdminData,
      refetchInvoiceData,
      loadNextPage,
      loadPrevPage,
    ],
  );
};
