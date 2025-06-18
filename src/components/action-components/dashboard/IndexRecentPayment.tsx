"use client";

import { useContext } from "react";
import DataTable from "./DataTable";
import { ContractContext } from "@/context/contract-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import baseColumns from "./baseColumns";
import invoiceActions from "./invoices-components/invoiceActions";
import marketplaceActions from "./marketplace-components/marketplaceActions";

const IndexRecentPayment = ({
  isMarketplaceTab,
}: {
  isMarketplaceTab: boolean;
}) => {
  const { invoiceData } = useContext(ContractContext);
  // const [currentTab, setCurrentTab] = useState("seller");

  const allSimpleInvoices = {
    seller: invoiceData.filter(
      (invoice) => invoice.type === "Seller" && invoice.source === "Simple"
    ),
    buyer: invoiceData.filter(
      (invoice) => invoice.type === "Buyer" && invoice.source === "Simple"
    ),
    all: invoiceData.filter((invoice) => invoice.source === "Simple"),
  };

  const allMarketplaceInvoices = {
    seller: invoiceData.filter(
      (invoice) =>
        invoice.type === "IssuedInvoice" && invoice.source === "Marketplace"
    ),
    buyer: invoiceData.filter(
      (invoice) =>
        invoice.type === "ReceivedInvoice" && invoice.source === "Marketplace"
    ),
    all: invoiceData.filter((invoice) => invoice.source === "Marketplace"),
  };

  const dropdownStatusesByTab = {
    simple: {
      seller: [
        { label: "All", value: "ALL" },
        { label: "Created", value: "CREATED" },
        { label: "Accepted", value: "ACCEPTED" },
        { label: "Paid", value: "PAID" },
        { label: "Rejected", value: "REJECTED" },
        { label: "Cancelled", value: "CANCELLED" },
        { label: "Refunded", value: "REFUNDED" },
        { label: "Released", value: "RELEASED" },
      ],
      buyer: [
        { label: "All", value: "ALL" },
        { label: "Accepted", value: "ACCEPTED" },
        { label: "Paid", value: "PAID" },
        { label: "Rejected", value: "REJECTED" },
        { label: "Refunded", value: "REFUNDED" },
        { label: "Released", value: "RELEASED" },
      ],
      all: [
        { label: "All", value: "ALL" },
        { label: "Created", value: "CREATED" },
        { label: "Accepted", value: "ACCEPTED" },
        { label: "Paid", value: "PAID" },
        { label: "Rejected", value: "REJECTED" },
        { label: "Cancelled", value: "CANCELLED" },
        { label: "Refunded", value: "REFUNDED" },
        { label: "Released", value: "RELEASED" },
      ],
    },

    marketplace: {
      all: [
        { label: "All", value: "ALL" },
        { label: "Created", value: "CREATED" },
        { label: "Accepted", value: "ACCEPTED" },
        { label: "Paid", value: "PAID" },
        { label: "Rejected", value: "REJECTED" },
        { label: "Cancelled", value: "CANCELED" },
        { label: "Released", value: "RELEASED" },
        { label: "Disputed", value: "DISPUTED" },
        { label: "Dispute Resolved", value: "DISPUTE RESOLVED" },
        { label: "Dispute Dismissed", value: "DISPUTE DISMISSED" },
        { label: "Dispute Settled", value: "DISPUTE SETTLED" },
        { label: "Cancelation Requested", value: "CANCELATION REQUESTED" },
        { label: "Cancelation Accepted", value: "CANCELATION_ACCEPTED" },
        { label: "Cancelation Rejected", value: "CANCELATION_REJECTED" },
      ],
      seller: [
        { label: "All", value: "ALL" },
        { label: "Created", value: "CREATED" },
        { label: "Accepted", value: "ACCEPTED" },
        { label: "Paid", value: "PAID" },
        { label: "Rejected", value: "REJECTED" },
      ],
      buyer: [
        { label: "All", value: "ALL" },
        { label: "Paid", value: "PAID" },
        { label: "Released", value: "RELEASED" },
        { label: "Disputed", value: "DISPUTED" },
      ],
    },
  };

  const tabItems = [
    {
      value: "all",
      label: "All",
    },
    {
      value: "seller",
      label: isMarketplaceTab ? "Issued Invoices" : "Created by me",
    },
    {
      value: "buyer",
      label: isMarketplaceTab ? "Received Invoices" : "Paid by me",
    },
  ];

  const invoiceColumns = [...baseColumns, ...invoiceActions];
  const marketplaceColumns = [...baseColumns, ...marketplaceActions];

  const invoicesByTab = isMarketplaceTab
    ? allMarketplaceInvoices
    : allSimpleInvoices;
  const sourceKey = isMarketplaceTab ? "marketplace" : "simple";
  return (
    <div className="container mx-auto">
      <Tabs
        defaultValue="seller"
        // onValueChange={(value) => setCurrentTab(value)}
      >
        <TabsList>
          {tabItems.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabItems.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <DataTable
              columns={isMarketplaceTab ? marketplaceColumns : invoiceColumns}
              data={
                tab.value === "all"
                  ? invoicesByTab.seller.concat(invoicesByTab.buyer)
                  : invoicesByTab[tab.value as "seller" | "buyer"]
              }
              statuses={
                dropdownStatusesByTab[sourceKey][
                  tab.value as "seller" | "buyer" | "all"
                ]
              }
              currentTab={tab.value === "buyer" ? "buyer" : undefined}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default IndexRecentPayment;
