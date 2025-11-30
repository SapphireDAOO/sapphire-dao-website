/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  GET_ALL_INVOICES,
  invoiceQuery,
  invoiceOwnerQuery,
} from "@/services/graphql/queries";
import { useAccount, usePublicClient } from "wagmi";
import { unixToGMT } from "@/utils";
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
            state: list.status === "CREATED" ? "AWAITING PAYMENT" : list.status,
            releaseHash: list.releaseHash,
            status:
              list.status === "CREATED" ? "AWAITING PAYMENT" : list.status,
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
            status: list.state === "CREATED" ? "AWAITING PAYMENT" : list.status,
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
          ...createdInvoice.map((invoice: any) => ({
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
          }))
        );

        paidInvoiceData.push(
          ...paidInvoices.map((invoice: any) => ({
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
          }))
        );

        issuedInvoicesData.push(
          ...issuedInvoices.map((invoice: any) => ({
            id: invoice.invoiceId,
            orderId: invoice.id,
            createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
            paidAt: invoice.paidAt || "Not Paid",
            status:
              invoice.state === "CREATED" ? "AWAITING PAYMENT" : invoice.state,
            price: invoice.price ? formatEther(BigInt(invoice.price)) : null,
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
            status:
              invoice.state === "CREATED" ? "AWAITING PAYMENT" : invoice.state,
            price: invoice.price ? formatEther(BigInt(invoice.price)) : null,
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
      const existingByKey = new Map<string, Invoice>();
      invoiceDataRef.current.forEach((inv) => {
        const key = `${inv.orderId.toString()}-${inv.type}-${inv.source}`;
        existingByKey.set(key, inv);
      });

      const mergedInvoiceData = sortedInvoiceData.map((inv) => {
        const key = `${inv.orderId.toString()}-${inv.type}-${inv.source}`;
        const existing = existingByKey.get(key);
        if (!existing) return inv as Invoice;

        return {
          ...existing,
          ...inv,
          status: pickNewerStatus(existing.status ?? "", inv.status!),
        } as Invoice;
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
    if (!address || !chain) {
      setInvoiceData([]);
      setAllInvoiceData({
        invoices: [],
        actions: [],
        marketplaceInvoices: [],
      });
      return;
    }

    fetchLatestInvoices(true, "user");
  }, [address, chain, fetchLatestInvoices]);

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
      "InvoicePaid",
      "InvoiceAccepted",
      "InvoiceRejected",
      "InvoiceRefunded",
      "InvoiceReleased",
      "InvoiceCanceled",
      "InvoiceCreated",
    ];

    const unwatch = eventNames.map((name) =>
      publicClient.watchContractEvent({
        address: SIMPLE_PAYMENT_PROCESSOR[chainId],
        abi: paymentProcessor,
        eventName: name as
          | "InvoicePaid"
          | "InvoiceAccepted"
          | "InvoiceRejected"
          | "InvoiceRefunded"
          | "InvoiceReleased"
          | "InvoiceCanceled"
          | "InvoiceCreated",
        onLogs: (logs) => {
          setInvoiceData((prev) => {
            let updated = prev;
            let shouldRefresh = false;

            for (const log of logs) {
              const orderId = (
                log.args?.orderId as bigint | undefined
              )?.toString();

              const invoice = (log.args as any)?.invoice as
                | {
                    buyer?: string;
                    seller?: string;
                    price?: bigint;
                    amountPaid?: bigint;
                    createdAt?: bigint;
                    paidAt?: bigint;
                  }
                | undefined;

              if (name === "InvoiceCreated") {
                const buyer = invoice?.buyer?.toLowerCase?.();
                const seller = invoice?.seller?.toLowerCase?.();

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
                        id: orderId,
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
              if (!exists) continue;

              updated = updated.map((inv) =>
                inv.orderId.toString() === orderId ? { ...inv, status } : inv
              );
              shouldRefresh = true;
            }

            if (shouldRefresh) {
              scheduleUserRefresh();
            }

            return updated;
          });
        },
        onError: (err) =>
          console.error("invoice status subscription error", err),
      })
    );

    return () => {
      unwatch.forEach((u) => u?.());
    };
  }, [publicClient, address, chainId, scheduleUserRefresh]);

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
      "InvoicePaid",
      "InvoiceCanceled",
      "PaymentReleased",
      "Refunded",
      "DisputeCreated",
      "DisputeResolved",
      "DisputeDismissed",
      "DisputeSettled",
      "InvoiceCreated",
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
              const orderId = (
                log.args?.orderId as bigint | undefined
              )?.toString();

              if (name === "InvoiceCreated") {
                const invoice = (log.args as any)?.invoice as
                  | {
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
                        id: orderId,
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
                releaseUpdate = (log.args as any)?.newHoldPeriod as
                  | bigint
                  | undefined;
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

              updated = updated.map((inv) =>
                inv.orderId.toString() === orderId &&
                inv.source === "Marketplace"
                  ? {
                      ...inv,
                      status: status ?? inv.status,
                      releaseAt: releaseUpdate
                        ? releaseUpdate.toString()
                        : inv.releaseAt,
                    }
                  : inv
              );
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

  if (state === "CREATED") {
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
