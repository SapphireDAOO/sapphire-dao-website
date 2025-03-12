"use client";

import { useContext, useState } from "react";
import columns from "./columns";
import DataTable from "./data-table";
import { ContractContext } from "@/context/contract-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RecentPayment = () => {
  const { invoiceData } = useContext(ContractContext);
  const [currentTab, setCurrentTab] = useState("creator");

  // Filtered invoices for each tab
  const filteredCreatedInvoices = invoiceData.filter(
    (invoice) => invoice.type === "Creator"
  );

  const filteredPaidInvoices = invoiceData.filter(
    (invoice) => invoice.type === "Payer"
  );

  // Dropdown statuses
  const dropdownStatuses =
    currentTab === "creator"
      ? [
          { label: "All", value: "ALL" },
          { label: "Created", value: "CREATED" },
          { label: "Accepted", value: "ACCEPTED" },
          { label: "Paid", value: "PAID" },
          { label: "Rejected", value: "REJECTED" },
          { label: "Cancelled", value: "CANCELLED" },
          { label: "Refunded", value: "REFUNDED" },
          { label: "Released", value: "RELEASED" },
        ]
      : [
          { label: "All", value: "ALL" },
          { label: "Accepted", value: "ACCEPTED" },
          { label: "Paid", value: "PAID" },
          { label: "Rejected", value: "REJECTED" },
          { label: "Refunded", value: "REFUNDED" },
          { label: "Released", value: "RELEASED" },
        ];

  return (
    <div className="container mx-auto">
      <Tabs
        defaultValue="creator"
        onValueChange={(value) => setCurrentTab(value)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="creator">Created by me</TabsTrigger>
          <TabsTrigger value="payer">Paid by me</TabsTrigger>
        </TabsList>
        <TabsContent value="creator">
          <DataTable
            columns={columns}
            data={filteredCreatedInvoices}
            statuses={dropdownStatuses}
            currentTab={""}
          />
        </TabsContent>
        <TabsContent value="payer">
          <DataTable
            columns={columns}
            data={filteredPaidInvoices}
            statuses={dropdownStatuses}
            currentTab={"payer"}
          />
        </TabsContent>
        <TabsContent value="all">
          <DataTable
            columns={columns}
            data={filteredPaidInvoices.concat(filteredCreatedInvoices)}
            statuses={dropdownStatuses}
            currentTab={""}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecentPayment;
