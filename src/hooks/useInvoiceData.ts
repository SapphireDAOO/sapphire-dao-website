/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
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
import { BASE_SEPOLIA, SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
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
import {
  sortState,
  sortHistory,
  synthesizeMarketplaceHistory,
  pickNewerStatus,
  nowInSeconds,
  appendHistoryEntry,
  mergeHistory,
  getLastActionTime,
} from "@/lib/invoiceHistory";
import {
  getInvoiceCacheKey,
  readInvoiceCache,
  writeInvoiceCache,
} from "@/lib/invoiceCache";
import { useSimpleInvoiceEvents } from "./useSimpleInvoiceEvents";
import { useMarketplaceInvoiceEvents } from "./useMarketplaceInvoiceEvents";
import { useIsWindowVisible } from "./useIsWindowVisible";

const ERROR_BACKOFF_MS = 15_000;
const PAGE_SIZE = 24;
const ADMIN_INVOICE_CACHE_TTL_MS = 5_000;
const USER_INVOICE_PAGE_CACHE_TTL_MS = 2_000;
const USER_INVOICE_PAGE_CACHE_MAX = 100;
const LIVE_INVOICE_OVERLAY_LIMIT = 100;
const SIMPLE_INVOICE_READ_TTL_MS = 5_000;

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

// Use `id` (the nonce string) — `invoiceId` differs by source: event-hook
// entries hold BigInt(nonce); subgraph transforms hold the subgraph entity id
// ("0x..."). Mixing them caused the same invoice to render twice.
const getInvoiceMergeKey = (invoice: {
  id?: string | null;
  type?: string;
  source?: string;
}) => `${invoice.id ?? ""}-${invoice.type ?? ""}-${invoice.source ?? ""}`;

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
        byKey.set(`${invoice.invoiceId.toString()}-${invoice.type}`, invoice);
      }

      for (const invoice of prev) {
        const key = `${invoice.invoiceId.toString()}-${invoice.type}`;
        if (!byKey.has(key)) {
          byKey.set(key, invoice);
        }
      }

      return Array.from(byKey.values()).slice(0, LIVE_INVOICE_OVERLAY_LIMIT);
    });
  }, []);

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
  useEffect(() => {
    allInvoiceDataRef.current = allInvoiceData;
  }, [allInvoiceData]);

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
      if (
        Date.now() < nextAllowedRequestRef.current &&
        allInvoiceDataRef.current.invoices.length > 0
      ) {
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
          const { data, error } = await client(chainId)
            .query(GET_ALL_INVOICES, {
              skipInvoices: 0,
              firstInvoices: PAGE_SIZE,
              skipActions: 0,
              firstActions: PAGE_SIZE,
              skipSmartInvoices: 0,
              firstSmartInvoices: PAGE_SIZE,
            })
            .toPromise();

          if (error) {
            console.error("GraphQL Error:", error.message);
            handleRateLimit(error.message);
            return allInvoiceDataRef.current;
          }

          const rawInvoices = data?.invoices || [];
          const rawAdminActions = data?.adminActions || [];
          const rawMarketplaceInvoices = data?.smartInvoices || [];

          for (const list of rawInvoices) {
            invoices[invoices.length] = {
              id: list.invoiceId || "",
              invoiceId: list.id || "",
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
              status: sortState(list.state, list.invalidateAt),
              creationTxHash: list.creationTxHash,
              commisionTxHash: list.commisionTxHash,
              refundTxHash: list.refundTxHash,
            };
          }

          for (const list of rawAdminActions) {
            actions[actions.length] = {
              id: list.invoiceId || "",
              invoiceId: (() => {
                try {
                  return BigInt(list.invoiceId || "0");
                } catch {
                  return BigInt(0);
                }
              })(),
              action: list.action || "Unknown",
              time: list.time ? unixToGMT(list.time) : null,
              type: list.type,
              txHash: list.txHash,
              balance: list.balance ? formatEther(BigInt(list.balance)) : "0",
            };
          }

          for (const list of rawMarketplaceInvoices) {
            marketplaceInvoices[marketplaceInvoices.length] = {
              id: list.invoiceId,
              invoiceId: list.id,
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
    async (page = 0) => {
      if (!address) return;

      if (
        Date.now() < nextAllowedRequestRef.current &&
        invoiceData.length > 0
      ) {
        return;
      }

      const skip = page * PAGE_SIZE;
      const normalizedAddress = address.toLowerCase();
      const requestKey = `${chainId}:${normalizedAddress}:${PAGE_SIZE}:${skip}`;

      try {
        const cached = getCachedUserInvoicePage(requestKey);
        let result: UserInvoicePageResult;

        if (cached) {
          result = cached;
        } else {
          let inflight = userInvoicePageInflight.get(requestKey);
          if (!inflight) {
            inflight = client(chainId)
              .query(invoiceQuery, {
                address: normalizedAddress,
                first: PAGE_SIZE,
                skip,
              })
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

            userInvoicePageInflight.set(requestKey, inflight);
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

        const createdInvoice: UserCreatedInvoice[] =
          data.user.ownedInvoices || [];
        const paidInvoices: UserPaidInvoice[] = data.user.paidInvoices || [];
        const issuedInvoices: UserIssuedInvoiceInvoice[] =
          data.user.issuedInvoices || [];
        const receivedInvoices: UserReceivedInvoicesInvoice[] =
          data.user.receivedInvoices || [];

        const createdInvoiceData = createdInvoice.map((invoice: any) => ({
          id: invoice.invoiceId,
          invoiceId: invoice.id,
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: sortState(invoice.state, invoice.invalidateAt),
          price: invoice.price ? formatEther(BigInt(invoice.price)) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(BigInt(invoice.amountPaid))
            : null,
          type: "Seller" as const,
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          invalidateAt: invoice.invalidateAt,
          expiresAt: invoice.expiresAt,
          seller: invoice.seller?.id ?? "",
          buyer: invoice.buyer?.id ?? "",
          releaseHash: invoice.releaseHash,
          releaseAt: invoice.releasedAt,
          source: "Simple" as const,
          history: sortHistory(invoice.history, invoice.historyTime),
          refundTxHash: invoice.refundTxHash,
        }));

        const paidInvoiceData = paidInvoices.map((invoice: any) => ({
          id: invoice.invoiceId,
          invoiceId: invoice.id,
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: sortState(invoice.state, invoice.invalidateAt),
          price: invoice.price ? formatEther(BigInt(invoice.price)) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(BigInt(invoice.amountPaid))
            : null,
          type: "Buyer" as const,
          seller: invoice.seller?.id ?? "",
          contract: invoice.contract,
          invalidateAt: invoice.invalidateAt,
          expiresAt: invoice.expiresAt,
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
          id: invoice.invoiceId ?? invoice.id,
          invoiceId: invoice.id,
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
          paymentToken: invoice.paymentToken?.id ?? "",
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
              expiresAt: inv.expiresAt || existing.expiresAt,
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
    [address, chainId, handleRateLimit, invoiceData.length],
  );

  const getInvoiceOwner = async (id: string): Promise<string> => {
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
  };

  const getAdvancedInvoiceData = async (
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
  };

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
                expiresAt?: bigint | number;
                invalidateAt?: bigint | number;
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
        const invalidateAt = invoiceObject
          ? readBigInt(invoiceObject.invalidateAt)
          : readBigInt(invoiceArray?.[4] as bigint | number | undefined);
        const expiresAt = invoiceObject
          ? readBigInt(invoiceObject.expiresAt)
          : readBigInt(invoiceArray?.[5] as bigint | number | undefined);

        setInvoiceData((prev) => {
          const liveUpdates: Invoice[] = [];
          const next = prev.map((inv) => {
            if (inv.invoiceId.toString() !== invoiceId.toString()) return inv;

            const nextInvoice = {
              ...inv,
              status: inv.status === "PAID" ? "ACCEPTED" : inv.status,
              paidAt:
                inv.paidAt && inv.paidAt !== "Not Paid"
                  ? inv.paidAt
                  : paidAt
                    ? paidAt.toString()
                    : inv.paidAt,
              releaseAt: releaseAt ? releaseAt.toString() : inv.releaseAt,
              invalidateAt: invalidateAt
                ? invalidateAt.toString()
                : inv.invalidateAt,
              expiresAt: expiresAt ? expiresAt.toString() : inv.expiresAt,
            };
            liveUpdates.push(nextInvoice);
            return nextInvoice;
          });

          if (liveUpdates.length > 0) {
            queueMicrotask(() => publishLiveInvoices(liveUpdates));
          }

          return next;
        });
      } catch (error) {
        console.error("Failed to read invoice timing", error);
      }
    },
    [chainId, publicClient, publishLiveInvoices, readSimpleInvoiceChainData],
  );

  const hydrateSimpleInvoiceFromChain = useCallback(
    async (inv: bigint, paymentTxHash?: string) => {
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
                invalidateAt?: bigint | number;
                expiresAt?: bigint | number;
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

        const invoiceId = readBigInt(
          invoiceObject?.invoiceId ??
            (invoiceArray?.[0] as bigint | number | undefined),
        );

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
        const invalidateAt = readBigInt(
          invoiceObject?.invalidateAt ??
            (invoiceArray?.[4] as bigint | number | undefined),
        );
        const expiresAt = readBigInt(
          invoiceObject?.expiresAt ??
            (invoiceArray?.[5] as bigint | number | undefined),
        );
        const seller = readString(invoiceObject?.seller ?? invoiceArray?.[7]);
        const buyer = readString(invoiceObject?.buyer ?? invoiceArray?.[8]);
        const price = readBigInt(
          invoiceObject?.price ??
            (invoiceArray?.[10] as bigint | number | undefined),
        );
        const amountPaid = readBigInt(
          invoiceObject?.balance ??
            (invoiceArray?.[11] as bigint | number | undefined),
        );

        const normalizedAddress = address.toLowerCase();
        const isSeller =
          typeof seller === "string" &&
          seller.toLowerCase() === normalizedAddress;
        const isBuyer =
          typeof buyer === "string" &&
          buyer.toLowerCase() === normalizedAddress;

        if (!isSeller && !isBuyer) return;

        // invoiceId from chain data may be undefined; fall back to the parameter
        const resolvedInvoiceId = invoiceId ?? inv;

        const nextInvoice: Invoice = {
          id: invoiceNonce
            ? invoiceNonce.toString()
            : resolvedInvoiceId.toString(),
          invoiceId: resolvedInvoiceId,
          createdAt: createdAt ? unixToGMT(Number(createdAt)) : null,
          paidAt: paidAt && Number(paidAt) > 0 ? paidAt.toString() : "Not Paid",
          status: "PAID",
          price: price ? formatEther(price) : null,
          amountPaid: amountPaid ? formatEther(amountPaid) : "0",
          type: isSeller ? "Seller" : "Buyer",
          contract: contractAddress,
          buyer: buyer ?? "",
          seller: seller ?? "",
          source: "Simple",
          paymentTxHash,
          releaseAt: releaseAt ? releaseAt.toString() : undefined,
          invalidateAt: invalidateAt ? invalidateAt.toString() : undefined,
          expiresAt: expiresAt ? expiresAt.toString() : undefined,
          history: appendHistoryEntry(
            undefined,
            "PAID",
            paidAt?.toString() ?? nowInSeconds(),
          ),
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
              paymentTxHash: paymentTxHash ?? inv.paymentTxHash,
              releaseAt: nextInvoice.releaseAt || inv.releaseAt,
              invalidateAt: nextInvoice.invalidateAt || inv.invalidateAt,
              expiresAt: nextInvoice.expiresAt || inv.expiresAt,
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

  const fetchLatestInvoices = useCallback(
    async (
      force = false,
      mode: "user" | "admin" | "both" = "user",
    ): Promise<void> => {
      if (isFetchingRef.current && !force) return;

      isFetchingRef.current = true;
      try {
        if (mode === "user" || mode === "both") {
          await getInvoiceData();
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

    fetchLatestInvoices(true, "user");

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId]);

  useSimpleInvoiceEvents({
    active: activeEventTab === "simple" && isWindowVisible,
    address,
    chainId,
    publicClient,
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
    setInvoiceData,
    onLiveInvoices: publishLiveInvoices,
  });

  return {
    invoiceData,
    liveInvoiceData,
    allInvoiceData,
    invoicePage,
    hasNextPage,
    getInvoiceData,
    getAllInvoiceData,
    getInvoiceOwner,
    getAdvancedInvoiceData,
    setActiveEventTab,
    refetchAllInvoiceData: async () => {
      const data = await getAllInvoiceData(true);
      setAllInvoiceData(data);
    },
    refreshAdminData: async (force = false) =>
      fetchLatestInvoices(force, "admin"),
    refetchInvoiceData: () => getInvoiceData(currentPageRef.current),
    loadNextPage: () => getInvoiceData(currentPageRef.current + 1),
    loadPrevPage: () =>
      currentPageRef.current > 0
        ? getInvoiceData(currentPageRef.current - 1)
        : Promise.resolve(),
  };
};
