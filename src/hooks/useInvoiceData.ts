/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  GET_ALL_INVOICES,
  invoiceQuery,
  invoiceOwnerQuery,
  META_QUERY,
} from "@/services/graphql/queries";
import { useAccount, useBlockNumber } from "wagmi";
import { unixToGMT } from "@/utils";
import { ETHEREUM_SEPOLIA } from "@/constants";
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

const MIN_META_INTERVAL_MS = 7_000;
const ERROR_BACKOFF_MS = 15_000;
const PAGE_SIZE = 50;

export const useInvoiceData = () => {
  const { chain, address } = useAccount();
  const { data: latestBlock } = useBlockNumber({
    chainId: chain?.id || ETHEREUM_SEPOLIA,
    watch: true,
  });

  const chainId = chain?.id || ETHEREUM_SEPOLIA;

  const [invoiceData, setInvoiceData] = useState<Invoice[]>([]);
  const [allInvoiceData, setAllInvoiceData] = useState<AllInvoicesData>({
    invoices: [],
    actions: [],
    marketplaceInvoices: [],
  });

  // refs for meta + throttling
  const lastIndexedBlockRef = useRef<number>(0);
  const isFetchingRef = useRef(false);
  const lastMetaCheckRef = useRef<number>(0);
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
    if (Date.now() < nextAllowedRequestRef.current) {
      return allInvoiceData;
    }

    const invoices: AllInvoice[] = [];
    const actions: AdminAction[] = [];
    const marketplaceInvoices: AllInvoice[] = [];

    let skipInvoices = 0;
    let skipActions = 0;
    let skipSmartInvoices = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data, error } = await client(chainId)
          .query(GET_ALL_INVOICES, {
            skipInvoices,
            firstInvoices: PAGE_SIZE,
            skipActions,
            firstActions: PAGE_SIZE,
            skipSmartInvoices,
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
            fee: list.fee || "0",
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
            fee: list.fee || "0",
            state: list.status,
            releaseHash: list.releaseHash,
            status: list.state === "CREATED" ? "AWAITING PAYMENT" : list.status,
            creationTxHash: list.creationTxHash,
            commisionTxHash: list.commisionTxHash,
            refundTxHash: list.refundTxHash,
          }))
        );

        skipInvoices += rawInvoices.length;
        skipActions += rawAdminActions.length;
        skipSmartInvoices += rawMarketplaceInvoices.length;

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
    if (Date.now() < nextAllowedRequestRef.current) {
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
            status: sortState(invoice.state),
            price: invoice.price ? formatEther(invoice.price) : null,
            amountPaid: invoice.amountPaid
              ? formatEther(invoice.amountPaid)
              : null,
            type: "Seller" as const,
            contract: invoice.contract,
            paymentTxHash: invoice.paymentTxHash,
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
            status: sortState(invoice.state),
            price: invoice.price ? formatEther(invoice.price) : null,
            amountPaid: invoice.amountPaid
              ? formatEther(invoice.amountPaid)
              : null,
            type: "Buyer" as const,
            seller: invoice.seller?.id ?? "",
            contract: invoice.contract,
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
            price: invoice.price ? invoice.price : null,
            amountPaid: invoice.amountPaid
              ? formatEther(invoice.amountPaid)
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
            price: invoice.price ? invoice.price : null,
            amountPaid: invoice.amountPaid
              ? formatEther(invoice.amountPaid)
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

      setInvoiceData(allInvoiceDataCombined);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      if (typeof error === "object" && error !== null && "message" in error) {
        handleRateLimit((error as any).message);
      }
    }
  }, [address, chainId, handleRateLimit]);

  const getInvoiceOwner = async (id: string): Promise<string> => {
    // Respect rate-limit backoff
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
    // Respect rate-limit backoff
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

  const getSubgraphBlockNumber = useCallback(
    async (force = false): Promise<number | null> => {
      // Respect rate-limit backoff
      if (Date.now() < nextAllowedRequestRef.current) {
        return lastIndexedBlockRef.current || null;
      }

      const now = Date.now();
      // Throttle meta calls
      if (!force && now - lastMetaCheckRef.current < MIN_META_INTERVAL_MS) {
        return lastIndexedBlockRef.current || null;
      }

      try {
        const { data, error } = await client(chainId)
          .query(META_QUERY, {})
          .toPromise();

        lastMetaCheckRef.current = now;

        if (error) {
          console.error("GraphQL Error: meta", error.message);
          handleRateLimit(error.message);
          return lastIndexedBlockRef.current || null;
        }

        const blockNum = data?._meta?.block?.number;
        return typeof blockNum === "number"
          ? blockNum
          : lastIndexedBlockRef.current || null;
      } catch (err: any) {
        console.error("Error fetching subgraph meta:", err);
        if (err?.message) {
          handleRateLimit(err.message);
        }
        return lastIndexedBlockRef.current || null;
      }
    },
    [chainId, handleRateLimit]
  );

  const refreshIfIndexed = useCallback(
    async (force = false, mode: "user" | "admin" | "both" = "user") => {
      const subgraphBlock = await getSubgraphBlockNumber(force);
      if (subgraphBlock === null) {
        if (force) {
          await fetchLatestInvoices(true, mode);
        }
        return;
      }

      if (!force && subgraphBlock <= lastIndexedBlockRef.current) {
        return;
      }

      lastIndexedBlockRef.current = subgraphBlock;
      await fetchLatestInvoices(force, mode);
    },
    [fetchLatestInvoices, getSubgraphBlockNumber]
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
      lastIndexedBlockRef.current = 0;
      return;
    }

    // Force refresh on initial load / account change
    refreshIfIndexed(true, "user");
  }, [address, chain, refreshIfIndexed]);

  // React to new blocks (throttled inside getSubgraphBlockNumber)
  useEffect(() => {
    if (!address || !chain || latestBlock === undefined) return;
    refreshIfIndexed(false, "user");
  }, [address, chain, latestBlock, refreshIfIndexed]);

  // When tab becomes visible again, force a check
  useEffect(() => {
    if (!address || !chain) return;

    const onVisibility = () => {
      if (!document.hidden) {
        refreshIfIndexed(true, "user");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [address, chain, refreshIfIndexed]);

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
    refreshAdminData: async (force = false) => refreshIfIndexed(force, "admin"),
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

const sortState = (state: string): string => {
  if (state === "CREATED") {
    return "AWAITING PAYMENT";
  }

  if (state === "REJECTED") {
    return "REFUNDED";
  }

  return state;
};
