// IndexRecentPayment.tsx (or wherever you render InvoiceCard)
"use client";

import { useContext, useState, useMemo } from "react";
import { ContractContext } from "@/context/contract-context";
import {
  FilterTabs,
  InvoiceCard,
  CreateInvoiceCard,
} from "./invoice-cards/index";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {  Note } from "@/model/model";

export default function IndexRecentPayment({
  isMarketplaceTab,
}: {
  isMarketplaceTab: boolean;
}) {
  const { invoiceData } = useContext(ContractContext);
  const [filter, setFilter] = useState("All");

  // Track ONLY ONE expanded card
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id)); // collapse if same
  };

  // Local notes
  const [localNotes, setLocalNotes] = useState<Record<string, Note[]>>({});

  const handleAddNote = (invoiceId: string, message: string) => {
    if (!message.trim()) return;
    const note: Note = {
      id: crypto.randomUUID(),
      sender: "You",
      message,
      timestamp: new Date().toLocaleString(),
    };
    setLocalNotes((prev) => ({
      ...prev,
      [invoiceId]: [...(prev[invoiceId] || []), note],
    }));
  };

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    let invoices = isMarketplaceTab
      ? invoiceData.filter((i) => i.source === "Marketplace")
      : invoiceData.filter((i) => i.source === "Simple");

    if (filter !== "All") {
      invoices = invoices.filter((i) => i.status === filter);
    }

    return invoices.map((inv) => ({
      ...inv,
      notes: [...(inv.notes || []), ...(localNotes[inv.id] || [])],
    }));
  }, [invoiceData, isMarketplaceTab, filter, localNotes]);

  return (
    <div className="container mx-auto mt-8">
      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="seller">
            {isMarketplaceTab ? "Issued" : "Created by me"}
          </TabsTrigger>
          <TabsTrigger value="buyer">
            {isMarketplaceTab ? "Received" : "Paid by me"}
          </TabsTrigger>
        </TabsList>

        {["all", "seller", "buyer"].map((tab) => {
          const tabInvoices = filteredInvoices.filter((inv) => {
            if (tab === "all") return true;
            if (tab === "seller")
              return inv.type === "Seller" || inv.type === "IssuedInvoice";
            if (tab === "buyer")
              return inv.type === "Buyer" || inv.type === "ReceivedInvoice";
            return false;
          });

          console.log(tab);

          return (
            <TabsContent key={tab} value={tab}>
              {/* Create Invoice (only in seller tab) */}
              {!isMarketplaceTab && (tab === "seller" || tab === "all") && (
                <CreateInvoiceCard />
              )}

              {/* Filter */}
              <FilterTabs
                filters={[
                  "All",
                  "AWAITING PAYMENT",
                  "PAID",
                  "ACCEPTED",
                  "REJECTED",
                  "CANCELLED",
                  "RELEASED",
                ]}
                onSelect={setFilter}
              />

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tabInvoices.map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    isExpanded={expandedId === String(invoice.id)}
                    onToggle={() => handleToggle(String(invoice.id))}
                    onAddNote={handleAddNote}
                  />
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
