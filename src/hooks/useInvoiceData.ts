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
import { unixToGMT, decryptNoteBlob } from "@/utils";
import {
  ETHEREUM_SEPOLIA,
  ADVANCED_PAYMENT_PROCESSOR,
  SIMPLE_PAYMENT_PROCESSOR,
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

import { formatEther, type AbiEvent } from "viem";
import { client } from "@/services/graphql/client";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
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
import { getInvoiceCacheKey, readInvoiceCache, writeInvoiceCache } from "@/lib/invoiceCache";

const ERROR_BACKOFF_MS = 15_000;
const PAGE_SIZE = 24;
const MAX_ADMIN_PAGES = 10;

export const useInvoiceData = () => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || ETHEREUM_SEPOLIA;

  const publicClient = usePublicClient({
    chainId,
  });

  const [invoiceData, setInvoiceData] = useState<Invoice[]>([]);
  const [allInvoiceData, setAllInvoiceData] = useState<AllInvoicesData>({
    invoices: [],
    actions: [],
    marketplaceInvoices: [],
  });

  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [invoicePage, setInvoicePage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const currentPageRef = useRef(0);

  const isFetchingRef = useRef(false);
  const nextAllowedRequestRef = useRef<number>(0);
  const hasFetchedRef = useRef(false);
  const cacheKey = getInvoiceCacheKey(address, chainId);

  // Keep a ref to invoiceData so callbacks don't depend on it and cause re-subscribe loops
  const invoiceDataRef = useRef<Invoice[]>([]);
  useEffect(() => {
    invoiceDataRef.current = invoiceData;
  }, [invoiceData]);

  useEffect(() => {
    if (!cacheKey) return;
    if (!hasFetchedRef.current && invoiceData.length === 0) return;
    if (cacheWriteTimeoutRef.current) clearTimeout(cacheWriteTimeoutRef.current);
    cacheWriteTimeoutRef.current = setTimeout(() => {
      writeInvoiceCache(cacheKey, invoiceData);
      cacheWriteTimeoutRef.current = null;
    }, 1000);
    return () => {
      if (cacheWriteTimeoutRef.current) clearTimeout(cacheWriteTimeoutRef.current);
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
      allInvoiceData.invoices.length > 0
    ) {
      return allInvoiceData;
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
            orderId: list.id || "",
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
            orderId: list.id || "",
            action: list.action || "Unknown",
            time: list.time ? unixToGMT(list.time) : null,
            type: list.type,
            txHash: list.txHash,
          })),
        );

        marketplaceInvoices.push(
          ...rawMarketplaceInvoices.map((list: any) => ({
            id: list.invoiceId,
            orderId: list.id,
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
            state: list.status,
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
  }, [chainId, allInvoiceData, handleRateLimit]);

  const getInvoiceData = useCallback(async (page = 0) => {
    if (
      Date.now() < nextAllowedRequestRef.current &&
      invoiceDataRef.current.length > 0
    ) {
      return;
    }

    const skip = page * PAGE_SIZE;

    try {
      const { data, error } = await client(chainId)
        .query(invoiceQuery, {
          address: address?.toLowerCase(),
          first: PAGE_SIZE,
          skip,
        })
        .toPromise();

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
        orderId: invoice.id,
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
        sellerNote: decryptNoteBlob(invoice.sellerNote),
      }));

      const paidInvoiceData = paidInvoices.map((invoice: any) => ({
        id: invoice.invoiceId,
        orderId: invoice.id,
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
        buyerNote: decryptNoteBlob(invoice.buyerNote),
      }));

      const mapMarketplaceInvoice = (
        invoice: any,
        type: "IssuedInvoice" | "ReceivedInvoice",
      ) => ({
        id: invoice.invoiceId ?? invoice.id,
        orderId: invoice.id,
        createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
        paidAt: invoice.paidAt || "Not Paid",
        status: sortState(invoice.state),
        price: invoice.price ?? null,
        amountPaid: invoice.amountPaid
          ? formatEther(BigInt(invoice.amountPaid))
          : null,
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
        (inv: any) => mapMarketplaceInvoice(inv, "IssuedInvoice") as UserIssuedInvoiceInvoice,
      );
      const receivedInvoicesData = receivedInvoices.map(
        (inv: any) => mapMarketplaceInvoice(inv, "ReceivedInvoice") as UserReceivedInvoicesInvoice,
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
          `${inv.orderId.toString()}-${inv.type}-${inv.source}`,
          inv,
        ]),
      );

      sortedInvoiceData.forEach((inv) => {
        const key = `${inv.orderId?.toString()}-${inv.type}-${inv.source}`;
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
          releaseAt: Number(existing.releaseAt) > 0
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
  }, [address, chainId, handleRateLimit]);

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
    orderId: bigint,
    type: "smartInvoice" | "metaInvoice",
  ): Promise<any> => {
    if (Date.now() < nextAllowedRequestRef.current) {
      return "";
    }

    const { data, error } = await client(chainId)
      .query(CHECKOUT_QUERIES[type], { id: orderId })
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
    async (orderId: bigint) => {
      if (!publicClient) return;
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return;

      try {
        const data = await publicClient.readContract({
          address: contractAddress,
          abi: paymentProcessor,
          functionName: "getInvoiceData",
          args: [orderId],
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
            if (inv.orderId.toString() !== orderId.toString()) return inv;

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
    async (orderId: bigint, paymentTxHash?: string) => {
      if (!publicClient || !address) return;
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId];
      if (!contractAddress) return;

      try {
        const data = await publicClient.readContract({
          address: contractAddress,
          abi: paymentProcessor,
          functionName: "getInvoiceData",
          args: [orderId],
        });

        const invoiceData = data as unknown;
        const invoiceArray = Array.isArray(invoiceData)
          ? (invoiceData as readonly unknown[])
          : null;
        const invoiceObject =
          invoiceData && typeof invoiceData === "object"
            ? (invoiceData as {
                invoiceId?: bigint | number;
                createdAt?: bigint | number;
                paidAt?: bigint | number;
                releaseAt?: bigint | number;
                invalidateAt?: bigint | number;
                expiresAt?: bigint | number;
                seller?: string;
                buyer?: string;
                price?: bigint | number;
                amountPaid?: bigint | number;
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
          invoiceObject?.amountPaid ??
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

        const nextInvoice: Invoice = {
          id: invoiceId ? invoiceId.toString() : orderId.toString(),
          orderId: BigInt(orderId),
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
            (inv) => inv.orderId.toString() === orderId.toString(),
          );

          if (!exists) {
            return [nextInvoice, ...prev];
          }

          return prev.map((inv) => {
            if (inv.orderId.toString() !== orderId.toString()) return inv;

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

  // Realtime status updates for simple invoices — single watcher for all event types
  useEffect(() => {
    if (!publicClient || !address) return;
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

    const simpleEvents = (paymentProcessor as readonly { type: string }[]).filter(
      (item): item is AbiEvent => item.type === "event",
    );

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: simpleEvents,
      onLogs: (logs) => {
          const batchTime = nowInSeconds();
          const acceptedOrderIds: string[] = [];
          const hydrateRequests = new Map<string, string | undefined>();
          setInvoiceData((prev) => {
            // O(n) Map build — keyed by `${orderId}-${source}` to avoid collisions
            const updatedMap = new Map<string, Invoice>(
              prev.map((inv) => [`${inv.orderId.toString()}-${inv.source}`, inv]),
            );

            for (const log of logs) {
              const name = log.eventName ?? "";
              const args = log.args as
                | {
                    orderId?: bigint;
                    buyer?: string;
                    amountPaid?: bigint;
                    expiresAt?: bigint;
                    invoice?: {
                      invoiceId?: bigint;
                      buyer?: string;
                      seller?: string;
                      price?: bigint;
                      amountPaid?: bigint;
                      createdAt?: bigint;
                      paidAt?: bigint;
                      invalidateAt?: bigint;
                      expiresAt?: bigint;
                    };
                  }
                | undefined;
              const orderId = args?.orderId?.toString();
              const invoice = args?.invoice;

              if (name === "InvoiceCreated") {
                const buyer = invoice?.buyer?.toLowerCase?.();
                const seller = invoice?.seller?.toLowerCase?.();
                const invoiceId = invoice?.invoiceId?.toString();
                const historyTime = invoice?.createdAt
                  ? invoice.createdAt.toString()
                  : batchTime;

                if (
                  address &&
                  (buyer === address.toLowerCase() ||
                    seller === address.toLowerCase())
                ) {
                  const simpleKey = `${orderId}-Simple`;
                  if (!updatedMap.has(simpleKey) && orderId && invoice) {
                    updatedMap.set(simpleKey, {
                      id: invoiceId ?? orderId,
                      orderId: BigInt(orderId),
                      createdAt: invoice.createdAt
                        ? unixToGMT(Number(invoice.createdAt))
                        : null,
                      paidAt:
                        invoice.paidAt && Number(invoice.paidAt) > 0
                          ? unixToGMT(Number(invoice.paidAt))
                          : "Not Paid",
                      status: "AWAITING PAYMENT",
                      price: invoice.price ? formatEther(invoice.price) : null,
                      amountPaid: invoice.amountPaid
                        ? formatEther(invoice.amountPaid)
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
                      history: appendHistoryEntry(undefined, "CREATED", historyTime),
                    } as Invoice);
                  }
                }
                continue;
              }

              if (!orderId) continue;

              const status = statusFromEvent[name];
              if (!status) continue;

              const simpleKey = `${orderId}-Simple`;
              if (!updatedMap.has(simpleKey)) {
                if (name === "InvoicePaid") {
                  const buyer = args?.buyer?.toLowerCase?.();
                  const isBuyer = address && buyer === address.toLowerCase();

                  if (isBuyer && orderId) {
                    updatedMap.set(simpleKey, {
                      id: orderId,
                      orderId: BigInt(orderId),
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
                    } as Invoice);
                  }

                  hydrateRequests.set(orderId, log.transactionHash);
                }
                continue;
              }

              const inv = updatedMap.get(simpleKey)!;
              const updatedFields: Partial<Invoice> = {
                status,
                history: appendHistoryEntry(inv.history, status, batchTime),
              };

              // amountPaid (InvoicePaid)
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

              // refunded amounts (InvoiceRejected / InvoiceRefunded)
              if (name === "InvoiceRejected" || name === "InvoiceRefunded") {
                if (invoice?.amountPaid !== undefined) {
                  updatedFields.amountPaid = formatEther(invoice.amountPaid);
                }
                updatedFields.refundTxHash =
                  log.transactionHash ?? inv.refundTxHash;
              }

              if (name === "InvoiceReleased") {
                updatedFields.releaseHash = log.transactionHash ?? inv.releaseHash;
              }

              updatedMap.set(simpleKey, { ...inv, ...updatedFields });

              if (name === "InvoiceAccepted") {
                acceptedOrderIds.push(orderId);
              }
            }

            return Array.from(updatedMap.values());
          });

          acceptedOrderIds.forEach((id) => {
            try {
              void updateSimpleInvoiceTiming(BigInt(id));
            } catch {
              // ignore invalid orderId parsing
            }
          });

          hydrateRequests.forEach((txHash, id) => {
            try {
              void hydrateSimpleInvoiceFromChain(BigInt(id), txHash);
            } catch {
              // ignore invalid orderId parsing
            }
          });
      },
      onError: (err) =>
        console.error("invoice status subscription error", err),
    });

    return () => {
      unwatch();
    };
  }, [
    publicClient,
    address,
    chainId,
    updateSimpleInvoiceTiming,
    hydrateSimpleInvoiceFromChain,
  ]);

  // Realtime status updates for marketplace (advanced) invoices — single watcher for all event types
  useEffect(() => {
    if (!publicClient || !address) return;
    const contractAddress = ADVANCED_PAYMENT_PROCESSOR[chainId];
    if (!contractAddress) return;

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
      advancedPaymentProcessor as readonly { type: string }[]
    ).filter((item): item is AbiEvent => item.type === "event");

    const unwatch = publicClient.watchEvent({
      address: contractAddress,
      events: marketEvents,
      onLogs: (logs) => {
        const batchTime = nowInSeconds();
        setInvoiceData((prev) => {
          // O(n) Map build — keyed by `${orderId}-${source}` to avoid collisions
          const updatedMap = new Map<string, Invoice>(
            prev.map((inv) => [`${inv.orderId.toString()}-${inv.source}`, inv]),
          );

          for (const log of logs) {
            const name = log.eventName ?? "";
            const logArgs = log.args as
                | {
                    orderId?: bigint;
                    amount?: bigint;
                    sellerAmount?: bigint;
                    newHoldPeriod?: bigint;
                  }
                | undefined;
              const orderId = logArgs?.orderId?.toString();

              if (name === "InvoiceCreated") {
                const invoice = (log.args as any)?.invoice as
                  | {
                      invoiceId?: bigint;
                      buyer?: string;
                      seller?: string;
                      price?: bigint;
                      amountPaid?: bigint;
                      createdAt?: bigint;
                      paymentToken?: string;
                      paidAt?: bigint;
                      releaseAt?: bigint;
                    }
                  | undefined;

                const buyer = invoice?.buyer?.toLowerCase?.();
                const seller = invoice?.seller?.toLowerCase?.();
                const invoiceId = invoice?.invoiceId?.toString();
                const historyTime = invoice?.createdAt
                  ? invoice.createdAt.toString()
                  : batchTime;

                if (
                  address &&
                  (buyer === address.toLowerCase() ||
                    seller === address.toLowerCase())
                ) {
                  const marketKey = `${orderId}-Marketplace`;
                  if (!updatedMap.has(marketKey) && orderId && invoice) {
                    updatedMap.set(marketKey, {
                      id: invoiceId ?? orderId,
                      orderId: BigInt(orderId),
                      createdAt: invoice.createdAt
                        ? unixToGMT(Number(invoice.createdAt))
                        : null,
                      paidAt:
                        invoice.paidAt && Number(invoice.paidAt) > 0
                          ? unixToGMT(Number(invoice.paidAt))
                          : "Not Paid",
                      status: "AWAITING PAYMENT",
                      price: invoice.price ? formatEther(invoice.price) : null,
                      amountPaid: invoice.amountPaid
                        ? formatEther(invoice.amountPaid)
                        : "0",
                      type:
                        seller === address.toLowerCase()
                          ? ("IssuedInvoice" as const)
                          : ("ReceivedInvoice" as const),
                      contract: contractAddress,
                      buyer: invoice.buyer ?? "",
                      seller: invoice.seller ?? "",
                      source: "Marketplace",
                      paymentToken: invoice.paymentToken ?? "",
                      releaseAt: invoice.releaseAt
                        ? invoice.releaseAt.toString()
                        : undefined,
                      history: appendHistoryEntry(undefined, "CREATED", historyTime),
                    } as Invoice);
                  }
                }
                continue;
              }

              if (!orderId) continue;

              const status = statusFromEvent[name];
              let releaseUpdate: bigint | undefined;

              if (name === "UpdateReleaseTime") {
                releaseUpdate = logArgs?.newHoldPeriod;
              }

              const marketKey = `${orderId}-Marketplace`;
              if (!updatedMap.has(marketKey)) continue;

              const inv = updatedMap.get(marketKey)!;
              const updatedFields: Partial<Invoice> = {
                status: status ?? inv.status,
                history: status
                  ? appendHistoryEntry(inv.history, status, batchTime)
                  : inv.history,
              };

              // marketplace: InvoicePaid → update amountPaid, paidAt, txHash
              if (name === "InvoicePaid") {
                if (logArgs?.amount !== undefined) {
                  updatedFields.amountPaid = formatEther(logArgs.amount);
                }
                updatedFields.paymentTxHash =
                  log.transactionHash ?? inv.paymentTxHash;
                updatedFields.paidAt =
                  inv.paidAt && inv.paidAt !== "Not Paid" ? inv.paidAt : batchTime;
              }

              // marketplace refunds
              if (name === "Refunded") {
                if (logArgs?.amount !== undefined) {
                  updatedFields.amountPaid = formatEther(logArgs.amount);
                }
                updatedFields.refundTxHash = log.transactionHash ?? inv.refundTxHash;
              }

              if (name === "PaymentReleased") {
                updatedFields.releaseHash = log.transactionHash ?? inv.releaseHash;
              }

              // release time updates
              if (releaseUpdate) {
                updatedFields.releaseAt = releaseUpdate.toString();
              }

              updatedMap.set(marketKey, { ...inv, ...updatedFields });
            }

            return Array.from(updatedMap.values());
          });
      },
      onError: (err) =>
        console.error("marketplace invoice status subscription error", err),
    });

    return () => {
      unwatch();
    };
  }, [publicClient, address, chainId]);

  return {
    invoiceData,
    allInvoiceData,
    invoicePage,
    hasNextPage,
    getInvoiceData,
    getAllInvoiceData,
    getInvoiceOwner,
    getAdvancedInvoiceData,
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
