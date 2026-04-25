/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  GET_ALL_INVOICES,
  invoiceQuery,
  invoiceOwnerQuery,
  smartInvoiceQuery,
  metaInvoiceQuery,
} from "@/services/graphql/queries";

const CHECKOUT_QUERIES = {
  smartInvoice: smartInvoiceQuery,
  metaInvoice: metaInvoiceQuery,
} as const;
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
const MAX_ADMIN_PAGES = 10;
const USER_INVOICE_PAGE_CACHE_TTL_MS = 2_000;

type UserInvoicePageResult = {
  data?: any;
  error?: any;
};

const userInvoicePageCache = new Map<
  string,
  { timestamp: number; result: UserInvoicePageResult }
>();
const userInvoicePageInflight = new Map<
  string,
  Promise<UserInvoicePageResult>
>();

const getCachedUserInvoicePage = (
  key: string,
): UserInvoicePageResult | null => {
  const cached = userInvoicePageCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > USER_INVOICE_PAGE_CACHE_TTL_MS) {
    userInvoicePageCache.delete(key);
    return null;
  }
  return cached.result;
};

export const useInvoiceData = () => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || BASE_SEPOLIA;

  const publicClient = usePublicClient({
    chainId,
  });

  const [invoiceData, setInvoiceData] = useState<Invoice[]>([]);
  const [allInvoiceData, setAllInvoiceData] = useState<AllInvoicesData>({
    invoices: [],
    actions: [],
    marketplaceInvoices: [],
  });

  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  // Keep refs so callbacks don't depend on state and cause re-subscribe loops
  const allInvoiceDataRef = useRef<AllInvoicesData>({ invoices: [], actions: [], marketplaceInvoices: [] });
  useEffect(() => { allInvoiceDataRef.current = allInvoiceData; }, [allInvoiceData]);

  const invoiceDataRef = useRef<Invoice[]>([]);
  useEffect(() => {
    invoiceDataRef.current = invoiceData;
  }, [invoiceData]);

  useEffect(() => {
    if (!cacheKey) return;
    if (!hasFetchedRef.current && invoiceData.length === 0) return;
    if (cacheWriteTimeoutRef.current)
      clearTimeout(cacheWriteTimeoutRef.current);
    cacheWriteTimeoutRef.current = setTimeout(() => {
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

  const getAllInvoiceData = useCallback(async (): Promise<AllInvoicesData> => {
    if (
      Date.now() < nextAllowedRequestRef.current &&
      allInvoiceDataRef.current.invoices.length > 0
    ) {
      return allInvoiceDataRef.current;
    }

    const invoices: AllInvoice[] = [];
    const actions: AdminAction[] = [];
    const marketplaceInvoices: AllInvoice[] = [];

    let page = 0;
    let hasMore = true;

    try {
      while (hasMore && page < MAX_ADMIN_PAGES) {
        const { data, error } = await client(chainId)
          .query(GET_ALL_INVOICES, {
            skipInvoices: page * PAGE_SIZE,
            firstInvoices: PAGE_SIZE,
            skipActions: page * PAGE_SIZE,
            firstActions: PAGE_SIZE,
            skipSmartInvoices: page * PAGE_SIZE,
            firstSmartInvoices: PAGE_SIZE,
          })
          .toPromise();

        if (error) {
          console.error("GraphQL Error:", error.message);
          handleRateLimit(error.message);
          break;
        }

        const rawInvoices = data?.invoices || [];
        const rawAdminActions = data?.adminActions || [];
        const rawMarketplaceInvoices = data?.smartInvoices || [];

        invoices.push(
          ...rawInvoices.map((list: any) => ({
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
          })),
        );

        actions.push(
          ...rawAdminActions.map((list: any) => ({
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
          })),
        );

        marketplaceInvoices.push(
          ...rawMarketplaceInvoices.map((list: any) => ({
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
          })),
        );

        page += 1;
        hasMore =
          rawInvoices.length === PAGE_SIZE ||
          rawAdminActions.length === PAGE_SIZE ||
          rawMarketplaceInvoices.length === PAGE_SIZE;
      }
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      if (typeof error === "object" && error !== null && "message" in error) {
        handleRateLimit((error as any).message);
      }
    }

    return { invoices, actions, marketplaceInvoices };
  }, [chainId, handleRateLimit]);

  const getInvoiceData = useCallback(
    async (page = 0) => {
      if (!address) return;

      if (
        Date.now() < nextAllowedRequestRef.current &&
        invoiceDataRef.current.length > 0
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
                  userInvoicePageCache.set(requestKey, {
                    timestamp: Date.now(),
                    result: queryResult,
                  });
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

        const sortedInvoiceData = allInvoiceDataCombined.sort((a, b) => {
          const timeA = getLastActionTime(a);
          const timeB = getLastActionTime(b);
          if (timeA === timeB) return 0;
          if (!timeA) return 1;
          if (!timeB) return -1;
          return Number(timeB) - Number(timeA);
        });

        // Seed the merge map with ALL in-memory invoices (not just the current
        // page). This ensures event-created invoices that haven't yet been indexed
        // by the subgraph survive subsequent getInvoiceData calls. Subgraph results
        // for the current page then overlay and update these entries below.
        const mergedByKey = new Map<string, Invoice>(
          invoiceDataRef.current.map((inv) => [
            `${inv.invoiceId.toString()}-${inv.type}-${inv.source}`,
            inv,
          ]),
        );

        sortedInvoiceData.forEach((inv) => {
          const key = `${inv.invoiceId?.toString()}-${inv.type}-${inv.source}`;
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

        const mergedInvoiceData = Array.from(mergedByKey.values()).sort(
          (a, b) => {
            const timeA = getLastActionTime(a);
            const timeB = getLastActionTime(b);
            if (timeA === timeB) return 0;
            if (!timeA) return 1;
            if (!timeB) return -1;
            return Number(timeB) - Number(timeA);
          },
        );

        const moreAvailable =
          createdInvoice.length === PAGE_SIZE ||
          paidInvoices.length === PAGE_SIZE ||
          issuedInvoices.length === PAGE_SIZE ||
          receivedInvoices.length === PAGE_SIZE;

        setInvoiceData(mergedInvoiceData);
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

  const refetchAllInvoiceData = useCallback(async () => {
    const fetchedInvoices = await getAllInvoiceData();
    setAllInvoiceData(fetchedInvoices);
  }, [getAllInvoiceData]);

  const updateSimpleInvoiceTiming = useCallback(
    async (invoiceId: bigint) => {
      if (!publicClient) return;
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return;

      try {
        const data = await publicClient.readContract({
          address: contractAddress,
          abi: paymentProcessor,
          functionName: "getInvoiceData",
          args: [invoiceId],
        });

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

        setInvoiceData((prev) =>
          prev.map((inv) => {
            if (inv.invoiceId.toString() !== invoiceId.toString()) return inv;

            return {
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
          }),
        );
      } catch (error) {
        console.error("Failed to read invoice timing", error);
      }
    },
    [chainId, publicClient],
  );

  const hydrateSimpleInvoiceFromChain = useCallback(
    async (inv: bigint, paymentTxHash?: string) => {
      if (!publicClient || !address) return;
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return;

      try {
        const data = await publicClient.readContract({
          address: contractAddress,
          abi: paymentProcessor,
          functionName: "getInvoiceData",
          args: [inv],
        });

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
          id: invoiceNonce ? invoiceNonce.toString() : resolvedInvoiceId.toString(),
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
            if (inv.invoiceId.toString() !== resolvedInvoiceId.toString()) return inv;

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
      } catch (error) {
        console.error("Failed to hydrate invoice from chain", error);
      }
    },
    [address, chainId, publicClient],
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
          await refetchAllInvoiceData();
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
      return;
    }

    hasFetchedRef.current = false;
    currentPageRef.current = 0;
    setInvoicePage(0);
    setHasNextPage(false);
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
  });

  useMarketplaceInvoiceEvents({
    active: activeEventTab === "marketplace" && isWindowVisible,
    address,
    chainId,
    publicClient,
    setInvoiceData,
  });

  return {
    invoiceData,
    allInvoiceData,
    invoicePage,
    hasNextPage,
    getInvoiceData,
    getAllInvoiceData,
    getInvoiceOwner,
    getAdvancedInvoiceData,
    setActiveEventTab,
    refetchAllInvoiceData: async () => {
      const data = await getAllInvoiceData();
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
