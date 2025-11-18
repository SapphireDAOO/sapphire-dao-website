/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect } from "react";
import {
  GET_ALL_INVOICES,
  invoiceQuery,
  invoiceOwnerQuery,
} from "@/services/graphql/queries";
import { useAccount } from "wagmi";
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

export const useInvoiceData = () => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || ETHEREUM_SEPOLIA;
  const [invoiceData, setInvoiceData] = useState<Invoice[]>([]);
  const [allInvoiceData, setAllInvoiceData] = useState<AllInvoicesData>({
    invoices: [],
    actions: [],
    marketplaceInvoices: [],
  });

  const getAllInvoiceData = useCallback(async (): Promise<AllInvoicesData> => {
    try {
      const { data, error } = await client(chainId)
        .query(GET_ALL_INVOICES, {}, { requestPolicy: "network-only" })
        .toPromise();

      if (error) {
        console.error("GraphQL Error:", error.message);
        return { invoices: [], actions: [], marketplaceInvoices: [] };
      }

      const rawInvoices = data?.invoices || [];
      const rawAdminActions = data?.adminActions || [];
      const rawMarketplaceInvoices = data?.smartInvoices || [];

      const invoices: AllInvoice[] = rawInvoices.map((list: any) => ({
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
        status: list.status === "CREATED" ? "AWAITING PAYMENT" : list.status,
        creationTxHash: list.creationTxHash,
        commisionTxHash: list.commisionTxHash,
      }));

      const actions: AdminAction[] = rawAdminActions.map((list: any) => ({
        id: list.invoiceId || "",
        orderId: list.id || "",
        action: list.action || "Unknown",
        time: list.time ? unixToGMT(list.time) : null,
        type: list.type,
        txHash: list.txHash,
      }));

      const marketplaceInvoices: AllInvoice[] = rawMarketplaceInvoices.map(
        (list: any) => ({
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
        })
      );

      return { invoices, actions, marketplaceInvoices };
    } catch (error) {
      console.error("❌ Error fetching invoice data:", error);
      return { invoices: [], actions: [], marketplaceInvoices: [] };
    }
  }, [chainId]);

  const getInvoiceData = useCallback(async () => {
    try {
      const { data, error } = await client(chainId)
        .query(
          invoiceQuery,
          { address: address?.toLowerCase() },
          { requestPolicy: "network-only" }
        )
        .toPromise();

      if (error) {
        console.log(error.message);
      }

      // Process created invoices
      const createdInvoice: UserCreatedInvoice[] =
        data?.user?.ownedInvoices || [];

      const paidInvoices: UserPaidInvoice[] = data?.user?.paidInvoices || [];

      const issuedInvoices: UserIssuedInvoiceInvoice[] =
        data?.user?.issuedInvoices || [];

      const receivedInvoices: UserReceivedInvoicesInvoice[] =
        data?.user?.receivedInvoices || [];

      // Format created invoices to fit with out model
      const createdInvoiceData: UserCreatedInvoice[] = createdInvoice.map(
        (invoice: any) => ({
          id: invoice.invoiceId,
          orderId: invoice.id,
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status:
            invoice.state === "CREATED" ? "AWAITING PAYMENT" : invoice.state,
          price: invoice.price ? formatEther(invoice.price) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(invoice.amountPaid)
            : null,
          type: "Seller",
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          seller: invoice.seller?.id ?? "",
          buyer: invoice.buyer?.id ?? "",
          releaseHash: invoice.releaseHash,
          releaseAt: invoice.releasedAt,
          source: "Simple",
          history: sortHistory(invoice.history, invoice.historyTime),
        })
      );

      // Format paid invoices
      const paidInvoiceData: UserPaidInvoice[] = paidInvoices.map(
        (invoice: any) => ({
          id: invoice.invoiceId,
          orderId: invoice.id,
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status:
            invoice.state === "CREATED" ? "AWAITING PAYMENT" : invoice.state,
          price: invoice.price ? formatEther(invoice.price) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(invoice.amountPaid)
            : null,
          type: "Buyer",
          seller: invoice.seller?.id ?? "",
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          releaseAt: invoice.releasedAt,
          buyer: invoice.buyer?.id ?? "",
          source: "Simple",
          history: sortHistory(invoice.history, invoice.historyTime),
        })
      );

      // Format Issued Invoices
      const issuedInvoicesData: UserIssuedInvoiceInvoice[] = issuedInvoices.map(
        (invoice: any) => ({
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
          type: "IssuedInvoice",
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          seller: invoice.seller?.id ?? "",
          releaseHash: invoice.releaseHash,
          releaseAt: invoice.releasedAt,
          buyer: invoice.buyer?.id ?? "",
          source: "Marketplace",
          paymentToken: invoice.paymentToken?.id ?? "",
          cancelAt: invoice.cancelAt,
        })
      );

      // Format Received Invoices
      const receivedInvoicesData: UserReceivedInvoicesInvoice[] =
        receivedInvoices.map((invoice: any) => ({
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
          type: "ReceivedInvoice",
          seller: invoice.seller?.id ?? "",
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          releaseAt: invoice.releasedAt,
          buyer: invoice.buyer?.id ?? "",
          source: "Marketplace",
          paymentToken: invoice.paymentToken?.id ?? "",
          cancelAt: invoice.cancelAt,
        }));

      // Combine created and paid invoices into a single list
      const allInvoiceData: (
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

      console.log("result after set", allInvoiceData);

      setInvoiceData([...allInvoiceData]);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
    }
  }, [address, chainId]);

  const getInvoiceOwner = async (id: string): Promise<string> => {
    const { data, error } = await client(chainId)
      .query(invoiceOwnerQuery, { id }, { requestPolicy: "network-only" })
      .toPromise();

    if (error) {
      console.error("GraphQL Error:", error.message);
      return "";
    }

    return data?.invoice?.seller?.id || "";
  };

  const getAdvancedInvoiceData = async (
    orderId: bigint,
    query: string,
    type: "smartInvoice" | "metaInvoice"
  ): Promise<any> => {
    const { data, error } = await client(chainId)
      .query(query, { id: orderId }, { requestPolicy: "network-only" })
      .toPromise();

    if (error) {
      console.error(`[GraphQL Error] ${type}:`, error.message);
      return "";
    }

    return data || "";
  };

  const refetchAllInvoiceData = useCallback(async () => {
    const fetchedInvoices = await getAllInvoiceData();
    setAllInvoiceData(fetchedInvoices);
  }, [getAllInvoiceData]);

  useEffect(() => {
    const onAddress = async () => {
      await getInvoiceData();
    };

    refetchAllInvoiceData();
    if (!address || !chain) {
      setInvoiceData([]);
      setAllInvoiceData({
        invoices: [],
        actions: [],
        marketplaceInvoices: [],
      });
    } else {
      onAddress();
    }
  }, [address, chain, getInvoiceData, refetchAllInvoiceData]);

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
