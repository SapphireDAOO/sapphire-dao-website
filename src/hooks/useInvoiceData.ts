/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  GET_ALL_INVOICES,
  invoiceQuery,
  invoiceOwnerQuery,
} from "@/services/graphql/queries";
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
  History,
} from "@/model/model";

import { formatEther } from "viem";
import { client } from "@/services/graphql/client";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";

const ERROR_BACKOFF_MS = 15_000;
const PAGE_SIZE = 50;
const REFRESH_DELAY_MS = 5_000;
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

  // Keep a ref to invoiceData so callbacks don't depend on it and cause re-subscribe loops
  const invoiceDataRef = useRef<Invoice[]>([]);
  useEffect(() => {
    invoiceDataRef.current = invoiceData;
  }, [invoiceData]);

  const refreshScheduledRef = useRef(false);
  const pendingRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const isFetchingRef = useRef(false);
  const nextAllowedRequestRef = useRef<number>(0);

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
          }))
        );

        actions.push(
          ...rawAdminActions.map((list: any) => ({
            id: list.invoiceId || "",
            orderId: list.id || "",
            action: list.action || "Unknown",
            time: list.time ? unixToGMT(list.time) : null,
            type: list.type,
            txHash: list.txHash,
          }))
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
          }))
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

  const getInvoiceData = useCallback(async () => {
    if (
      Date.now() < nextAllowedRequestRef.current &&
      invoiceDataRef.current.length > 0
    ) {
      return;
    }

    let skipOwned = 0;
    let skipPaid = 0;
    let skipIssued = 0;
    let skipReceived = 0;
    let hasMore = true;

    const createdInvoiceData: UserCreatedInvoice[] = [];
    const paidInvoiceData: UserPaidInvoice[] = [];
    const issuedInvoicesData: UserIssuedInvoiceInvoice[] = [];
    const receivedInvoicesData: UserReceivedInvoicesInvoice[] = [];

    try {
      while (hasMore) {
        const { data, error } = await client(chainId)
          .query(invoiceQuery, {
            address: address?.toLowerCase(),
            firstOwned: PAGE_SIZE,
            skipOwned,
            firstPaid: PAGE_SIZE,
            skipPaid,
            firstIssued: PAGE_SIZE,
            skipIssued,
            firstReceived: PAGE_SIZE,
            skipReceived,
          })
          .toPromise();

        if (error) {
          console.log(error.message);
          handleRateLimit(error.message);
          break;
        }

        if (!data?.user) {
          break;
        }

        const createdInvoice: UserCreatedInvoice[] =
          data?.user?.ownedInvoices || [];
        const paidInvoices: UserPaidInvoice[] = data?.user?.paidInvoices || [];
        const issuedInvoices: UserIssuedInvoiceInvoice[] =
          data?.user?.issuedInvoices || [];
        const receivedInvoices: UserReceivedInvoicesInvoice[] =
          data?.user?.receivedInvoices || [];

        createdInvoiceData.push(
          ...createdInvoice.map((invoice: any) => {
            const createdAt = invoice.createdAt
              ? unixToGMT(invoice.createdAt)
              : null;

            return {
              id: invoice.invoiceId,
              orderId: invoice.id,
              createdAt,
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
            };
          })
        );

        paidInvoiceData.push(
          ...paidInvoices.map((invoice: any) => {
            const createdAt = invoice.createdAt
              ? unixToGMT(invoice.createdAt)
              : null;

            return {
              id: invoice.invoiceId,
              orderId: invoice.id,
              createdAt,
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
            };
          })
        );

        issuedInvoicesData.push(
          ...issuedInvoices.map((invoice: any) => ({
            id: invoice.invoiceId,
            orderId: invoice.id,
            createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
            paidAt: invoice.paidAt || "Not Paid",
            status: sortState(invoice.state),
            price: invoice.price ? invoice.price : null,
            amountPaid: invoice.amountPaid
              ? formatEther(BigInt(invoice.amountPaid))
              : null,
            type: "IssuedInvoice" as const,
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
          }))
        );

        receivedInvoicesData.push(
          ...receivedInvoices.map((invoice: any) => ({
            id: invoice.invoiceId,
            orderId: invoice.id,
            createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
            paidAt: invoice.paidAt || "Not Paid",
            status: sortState(invoice.state),
            price: invoice.price ? invoice.price : null,
            amountPaid: invoice.amountPaid
              ? formatEther(BigInt(invoice.amountPaid))
              : null,
            type: "ReceivedInvoice" as const,
            seller: invoice.seller?.id ?? "",
            contract: invoice.contract,
            paymentTxHash: invoice.paymentTxHash,
            releaseAt: invoice.releasedAt,
            buyer: invoice.buyer?.id ?? "",
            source: "Marketplace" as const,
            paymentToken: invoice.paymentToken?.id ?? "",
            cancelAt: invoice.cancelAt,
            refundTxHash: invoice.refundTxHash,
          }))
        );

        skipOwned += createdInvoice.length;
        skipPaid += paidInvoices.length;
        skipIssued += issuedInvoices.length;
        skipReceived += receivedInvoices.length;

        hasMore =
          createdInvoice.length === PAGE_SIZE ||
          paidInvoices.length === PAGE_SIZE ||
          issuedInvoices.length === PAGE_SIZE ||
          receivedInvoices.length === PAGE_SIZE;
      }

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
        return timeB.localeCompare(timeA);
      });

      // avoid overwriting fresher websocket-driven statuses
      // with stale subgraph data. We merge by (orderId, type, source) and
      // keep the "later" status based on a defined priority ranking.
      const mergedByKey = new Map<string, Invoice>();
      invoiceDataRef.current.forEach((inv) => {
        const key = `${inv.orderId.toString()}-${inv.type}-${inv.source}`;
        mergedByKey.set(key, inv);
      });

      sortedInvoiceData.forEach((inv) => {
        const key = `${inv.orderId.toString()}-${inv.type}-${inv.source}`;
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

          releaseAt: inv.releaseAt || existing.releaseAt,
          expiresAt: inv.expiresAt || existing.expiresAt,
          buyer: inv.buyer || existing.buyer,

          status: pickNewerStatus(existing.status ?? "", inv.status ?? ""),
        } as Invoice);
      });

      const mergedInvoiceData = Array.from(mergedByKey.values()).sort((a, b) => {
        const timeA = getLastActionTime(a);
        const timeB = getLastActionTime(b);

        if (timeA === timeB) return 0;
        if (!timeA) return 1;
        if (!timeB) return -1;
        return timeB.localeCompare(timeA);
      });

      setInvoiceData(mergedInvoiceData);
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
    query: string,
    type: "smartInvoice" | "metaInvoice"
  ): Promise<any> => {
    if (Date.now() < nextAllowedRequestRef.current) {
      return "";
    }

    const { data, error } = await client(chainId)
      .query(query, { id: orderId })
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

  const scheduleUserRefresh = useCallback(() => {
    if (refreshScheduledRef.current || pendingRefreshTimeoutRef.current) return;
    refreshScheduledRef.current = true;
    pendingRefreshTimeoutRef.current = setTimeout(() => {
      getInvoiceData();
      refreshScheduledRef.current = false;
      pendingRefreshTimeoutRef.current = null;
    }, REFRESH_DELAY_MS);
  }, [getInvoiceData]);

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
          })
        );
      } catch (error) {
        console.error("Failed to read invoice timing", error);
      }
    },
    [chainId, publicClient]
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
            (invoiceArray?.[0] as bigint | number | undefined)
        );
        const createdAt = readBigInt(
          invoiceObject?.createdAt ??
            (invoiceArray?.[1] as bigint | number | undefined)
        );
        const paidAt = readBigInt(
          invoiceObject?.paidAt ??
            (invoiceArray?.[2] as bigint | number | undefined)
        );
        const releaseAt = readBigInt(
          invoiceObject?.releaseAt ??
            (invoiceArray?.[3] as bigint | number | undefined)
        );
        const invalidateAt = readBigInt(
          invoiceObject?.invalidateAt ??
            (invoiceArray?.[4] as bigint | number | undefined)
        );
        const expiresAt = readBigInt(
          invoiceObject?.expiresAt ??
            (invoiceArray?.[5] as bigint | number | undefined)
        );
        const seller = readString(
          invoiceObject?.seller ?? invoiceArray?.[7]
        );
        const buyer = readString(invoiceObject?.buyer ?? invoiceArray?.[8]);
        const price = readBigInt(
          invoiceObject?.price ??
            (invoiceArray?.[10] as bigint | number | undefined)
        );
        const amountPaid = readBigInt(
          invoiceObject?.amountPaid ??
            (invoiceArray?.[11] as bigint | number | undefined)
        );

        const normalizedAddress = address.toLowerCase();
        const isSeller =
          typeof seller === "string" &&
          seller.toLowerCase() === normalizedAddress;
        const isBuyer =
          typeof buyer === "string" && buyer.toLowerCase() === normalizedAddress;

        if (!isSeller && !isBuyer) return;

        const nextInvoice: Invoice = {
          id: invoiceId ? invoiceId.toString() : orderId.toString(),
          orderId: BigInt(orderId),
          createdAt: createdAt ? unixToGMT(Number(createdAt)) : null,
          paidAt:
            paidAt && Number(paidAt) > 0
              ? unixToGMT(Number(paidAt))
              : "Not Paid",
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
        };

        setInvoiceData((prev) => {
          const exists = prev.some(
            (inv) => inv.orderId.toString() === orderId.toString()
          );

          if (!exists) {
            return [nextInvoice, ...prev];
          }

          return prev.map((inv) => {
            if (inv.orderId.toString() !== orderId.toString()) return inv;

            return {
              ...inv,
              ...nextInvoice,
              status: pickNewerStatus(inv.status ?? "", nextInvoice.status ?? ""),
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
    [address, chainId, publicClient]
  );

  const fetchLatestInvoices = useCallback(
    async (
      force = false,
      mode: "user" | "admin" | "both" = "user"
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
    [getInvoiceData, refetchAllInvoiceData]
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

    fetchLatestInvoices(true, "user");

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId]);

  // Realtime status updates for simple invoices via websocket events
  useEffect(() => {
    if (!publicClient || !address) return;

    const statusFromEvent: Record<string, Invoice["status"]> = {
      InvoicePaid: "PAID",
      InvoiceAccepted: "ACCEPTED",
      InvoiceRejected: "REFUNDED",
      InvoiceRefunded: "REFUNDED",
      InvoiceReleased: "RELEASED",
      InvoiceCanceled: "CANCELED",
      InvoiceCreated: "AWAITING PAYMENT",
    };

    const eventNames: (keyof typeof statusFromEvent)[] = [
      "InvoiceCreated",
      "InvoicePaid",
      "InvoiceAccepted",
      "InvoiceRejected",
      "InvoiceRefunded",
      "InvoiceReleased",
      "InvoiceCanceled",
    ];

    const unwatch = eventNames.map((name) =>
      publicClient.watchContractEvent({
        address: SIMPLE_PAYMENT_PROCESSOR[chainId],
        abi: paymentProcessor,
        eventName: name as
          | "InvoiceCreated"
          | "InvoicePaid"
          | "InvoiceAccepted"
          | "InvoiceRejected"
          | "InvoiceRefunded"
          | "InvoiceReleased"
          | "InvoiceCanceled",
        onLogs: (logs) => {
          const acceptedOrderIds: string[] = [];
          const hydrateRequests = new Map<string, string | undefined>();
          setInvoiceData((prev) => {
            let updated = prev;
            let shouldRefresh = false;

            for (const log of logs) {
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
                    };
                  }
                | undefined;
              const orderId = args?.orderId?.toString();
              const invoice = args?.invoice;

              if (name === "InvoiceCreated") {
                const buyer = invoice?.buyer?.toLowerCase?.();
                const seller = invoice?.seller?.toLowerCase?.();
                const invoiceId = invoice?.invoiceId?.toString();

                if (
                  address &&
                  (buyer === address.toLowerCase() ||
                    seller === address.toLowerCase())
                ) {
                  const alreadyExists = updated.some(
                    (inv) => inv.orderId.toString() === orderId
                  );
                  if (!alreadyExists && orderId && invoice) {
                    updated = [
                      {
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
                        price: invoice.price
                          ? formatEther(invoice.price)
                          : null,
                        amountPaid: invoice.amountPaid
                          ? formatEther(invoice.amountPaid)
                          : "0",
                        type:
                          seller === address.toLowerCase()
                            ? ("Seller" as const)
                            : ("Buyer" as const),
                        contract: SIMPLE_PAYMENT_PROCESSOR[chainId],
                        buyer: invoice.buyer ?? "",
                        seller: invoice.seller ?? "",
                        source: "Simple",
                        // ...(sellerNotes
                        //   ? {
                        //       notes: sellerNotes,
                        //       note: sellerNotes[0]?.message,
                        //     }
                        //   : {}),
                      } as Invoice,
                      ...updated,
                    ];
                  }
                  shouldRefresh = true;
                }
                continue;
              }

              if (!orderId) continue;

              const status = statusFromEvent[name];
              if (!status) continue;

              const exists = updated.some(
                (inv) => inv.orderId.toString() === orderId
              );
              if (!exists) {
                if (name === "InvoicePaid") {
                  const buyer = args?.buyer?.toLowerCase?.();
                  const isBuyer =
                    address && buyer === address.toLowerCase();

                  if (isBuyer && orderId) {
                    updated = [
                      {
                        id: orderId,
                        orderId: BigInt(orderId),
                        createdAt: null,
                        paidAt: Math.floor(Date.now() / 1000).toString(),
                        status: "PAID",
                        price: null,
                        amountPaid:
                          args?.amountPaid !== undefined
                            ? formatEther(args.amountPaid)
                            : "0",
                        type: "Buyer",
                        contract: SIMPLE_PAYMENT_PROCESSOR[chainId],
                        buyer: args?.buyer ?? "",
                        seller: "",
                        source: "Simple",
                        expiresAt: args?.expiresAt?.toString(),
                        paymentTxHash: log.transactionHash,
                      } as Invoice,
                      ...updated,
                    ];
                    shouldRefresh = true;
                  }

                  if (orderId) {
                    hydrateRequests.set(orderId, log.transactionHash);
                  }
                }
                continue;
              }

              updated = updated.map((inv) => {
                if (inv.orderId.toString() !== orderId) return inv;

                const updatedFields: Partial<Invoice> = { status };

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
                      ? Math.floor(Date.now() / 1000).toString()
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

                return {
                  ...inv,
                  ...updatedFields,
                };
              });
              shouldRefresh = true;

              if (name === "InvoiceAccepted") {
                acceptedOrderIds.push(orderId);
              }
            }

            if (shouldRefresh) {
              scheduleUserRefresh();
            }

            return updated;
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
      })
    );

    return () => {
      unwatch.forEach((u) => u?.());
    };
  }, [
    publicClient,
    address,
    chainId,
    scheduleUserRefresh,
    updateSimpleInvoiceTiming,
    hydrateSimpleInvoiceFromChain,
  ]);

  // Realtime status updates for marketplace (advanced) invoices via websocket events
  useEffect(() => {
    if (!publicClient || !address) return;

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

    const eventNames: (keyof typeof statusFromEvent | "UpdateReleaseTime")[] = [
      "InvoiceCreated",
      "InvoicePaid",
      "InvoiceCanceled",
      "PaymentReleased",
      "Refunded",
      "DisputeCreated",
      "DisputeResolved",
      "DisputeDismissed",
      "DisputeSettled",
      "UpdateReleaseTime",
    ];

    const unwatch = eventNames.map((name) =>
      publicClient.watchContractEvent({
        address: ADVANCED_PAYMENT_PROCESSOR[chainId],
        abi: advancedPaymentProcessor,
        eventName: name as
          | "InvoicePaid"
          | "InvoiceCanceled"
          | "PaymentReleased"
          | "Refunded"
          | "DisputeCreated"
          | "DisputeResolved"
          | "DisputeDismissed"
          | "DisputeSettled"
          | "InvoiceCreated"
          | "UpdateReleaseTime",
        onLogs: (logs) => {
          setInvoiceData((prev) => {
            let updated = prev;
            let shouldRefresh = false;

            for (const log of logs) {
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

                if (
                  address &&
                  (buyer === address.toLowerCase() ||
                    seller === address.toLowerCase())
                ) {
                  const alreadyExists = updated.some(
                    (inv) => inv.orderId.toString() === orderId
                  );
                  if (!alreadyExists && orderId && invoice) {
                    updated = [
                      {
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
                        price: invoice.price
                          ? formatEther(invoice.price)
                          : null,
                        amountPaid: invoice.amountPaid
                          ? formatEther(invoice.amountPaid)
                          : "0",
                        type:
                          seller === address.toLowerCase()
                            ? ("IssuedInvoice" as const)
                            : ("ReceivedInvoice" as const),
                        contract: ADVANCED_PAYMENT_PROCESSOR[chainId],
                        buyer: invoice.buyer ?? "",
                        seller: invoice.seller ?? "",
                        source: "Marketplace",
                        paymentToken: invoice.paymentToken ?? "",
                        releaseAt: invoice.releaseAt
                          ? invoice.releaseAt.toString()
                          : undefined,
                      } as Invoice,
                      ...updated,
                    ];
                  }
                  shouldRefresh = true;
                }
                continue;
              }

              if (!orderId) continue;

              const status = statusFromEvent[name as string];
              let releaseUpdate: bigint | undefined;

              if (name === "UpdateReleaseTime") {
                releaseUpdate = logArgs?.newHoldPeriod;
              } else if (name === "InvoiceCreated") {
                releaseUpdate = (log.args as any)?.invoice?.releaseAt as
                  | bigint
                  | undefined;
              }

              const exists = updated.some(
                (inv) =>
                  inv.orderId.toString() === orderId &&
                  inv.source === "Marketplace"
              );
              if (!exists) continue;

              updated = updated.map((inv) => {
                if (
                  inv.orderId.toString() !== orderId ||
                  inv.source !== "Marketplace"
                )
                  return inv;

                const updatedFields: Partial<Invoice> = {
                  status: status ?? inv.status,
                };

                // marketplace: InvoicePaid → update amountPaid, paidAt, txHash
                if (name === "InvoicePaid") {
                  if (logArgs?.amount !== undefined) {
                    updatedFields.amountPaid = formatEther(logArgs.amount);
                  }
                  updatedFields.paymentTxHash =
                    log.transactionHash ?? inv.paymentTxHash;
                  updatedFields.paidAt =
                    inv.paidAt && inv.paidAt !== "Not Paid"
                      ? inv.paidAt
                      : Math.floor(Date.now() / 1000).toString();
                }

                // marketplace refunds
                if (name === "Refunded") {
                  if (logArgs?.amount !== undefined) {
                    updatedFields.amountPaid = formatEther(logArgs.amount);
                  }
                  updatedFields.refundTxHash =
                    log.transactionHash ?? inv.refundTxHash;
                }

                if (name === "PaymentReleased") {
                  updatedFields.releaseHash =
                    log.transactionHash ?? inv.releaseHash;
                }

                // release time updates
                if (releaseUpdate) {
                  updatedFields.releaseAt = releaseUpdate.toString();
                }

                return { ...inv, ...updatedFields };
              });
              shouldRefresh = true;
            }

            if (shouldRefresh) {
              scheduleUserRefresh();
            }

            return updated;
          });
        },
        onError: (err) =>
          console.error("marketplace invoice status subscription error", err),
      })
    );

    return () => {
      unwatch.forEach((u) => u?.());
    };
  }, [publicClient, address, chainId, scheduleUserRefresh]);

  // Clear any pending refresh timer on unmount
  useEffect(() => {
    return () => {
      if (pendingRefreshTimeoutRef.current) {
        clearTimeout(pendingRefreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    invoiceData,
    allInvoiceData,
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
    refetchInvoiceData: getInvoiceData,
  };
};

const sortHistory = (status?: string[], time?: string[]): History[] => {
  const history: History[] = [];

  if (!status || !Array.isArray(status) || status.length === 0) return history;
  if (!time || !Array.isArray(time) || time.length === 0) {
    return status.map((s) => ({ status: s, time: "" }));
  }

  const length = Math.min(status.length, time.length);

  for (let i = 0; i < length; i++) {
    history.push({
      status: status[i],
      time: time[i],
    });
  }

  return history;
};

const sortState = (state: string, voidAt?: string): string => {
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

const pickNewerStatus = (existing: string, incoming: string): string => {
  const existingRank = getStatusRank(existing);
  const incomingRank = getStatusRank(incoming);
  // higher/equal rank means "later" or same status; never downgrade
  return incomingRank >= existingRank ? incoming : existing;
};

const getLastActionTime = (invoice: Invoice): string | undefined => {
  if (invoice.history && invoice.history.length > 0) {
    return invoice.history[invoice.history.length - 1].time;
  }
  if (invoice.paidAt !== "Not Paid") {
    return invoice.paidAt;
  }
  return invoice.createdAt === null ? undefined : invoice.createdAt;
};
