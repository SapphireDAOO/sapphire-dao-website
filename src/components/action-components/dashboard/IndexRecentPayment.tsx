"use client";

import { useContext, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ContractContext } from "@/context/contract-context";
import {
  FilterTabs,
  InvoiceCard,
  CreateInvoiceCard,
} from "./invoice-cards/index";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Note } from "@/model/model";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IndexRecentPayment({
  isMarketplaceTab,
}: {
  isMarketplaceTab: boolean;
}) {
  const { invoiceData } = useContext(ContractContext);
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const params = useSearchParams();
  const router = useRouter();

  const defaultTab = params.get("tab") || "all";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      if (value === "all") {
        router.replace("/dashboard", { scroll: false });
      } else {
        router.replace(`/dashboard?tab=${value}`, { scroll: false });
      }
    },
    [router]
  );

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
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

  const filteredInvoices = useMemo(() => {
    let invoices = isMarketplaceTab
      ? invoiceData.filter((i) => i.source === "Marketplace")
      : invoiceData.filter((i) => i.source === "Simple");

    if (filter !== "All") {
      if (filter.startsWith("wallet:")) {
        const walletQuery = filter.replace("wallet:", "").trim().toLowerCase();
        if (walletQuery) {
          invoices = invoices.filter(
            (i) =>
              i.buyer?.toLowerCase().includes(walletQuery) ||
              i.seller?.toLowerCase().includes(walletQuery)
          );
        }
      } else {
        invoices = invoices.filter((i) => i.status === filter);
      }
    }

    if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      invoices = invoices.filter((i) => {
        if (!i.createdAt) return false;
        const created = new Date(i.createdAt).getTime();
        return created >= startOfDay.getTime() && created <= endOfDay.getTime();
      });
    }

    return invoices.map((inv) => ({
      ...inv,
      notes: [...(inv.notes || []), ...(localNotes[inv.id] || [])],
    }));
  }, [invoiceData, isMarketplaceTab, filter, selectedDate, localNotes]);

  return (
    <div className="container mx-auto mt-8">
      {/* Tabs that reflect URL state */}
      <Tabs defaultValue={activeTab} onValueChange={handleTabChange}>
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

          return (
            <TabsContent key={tab} value={tab}>
              {!isMarketplaceTab && (tab === "seller" || tab === "all") && (
                <CreateInvoiceCard />
              )}

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

              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center justify-end gap-2 w-full">
                  {/* Calendar */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <CalendarDays className="h-4 w-4" />
                        {selectedDate
                          ? selectedDate.toLocaleDateString()
                          : "Filter by Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="end"
                      className="w-auto p-0"
                    >
                      <Calendar
                        mode="single"
                        selected={selectedDate ?? undefined}
                        onSelect={(date) => setSelectedDate(date ?? null)}
                        className="rounded-md"
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Wallet filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        More Filters
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60 p-2">
                      <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <div className="px-2 py-1">
                        <input
                          type="text"
                          placeholder="Enter wallet address"
                          className="w-full border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                          onChange={(e) => {
                            const wallet = e.target.value.trim().toLowerCase();
                            setFilter("wallet:" + wallet);
                          }}
                        />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Clear Date */}
                  {selectedDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(null)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Cards Grid */}
              <div className="flex flex-wrap gap-5">
                {tabInvoices.length > 0 ? (
                  tabInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="w-full md:w-[48%] lg:w-[31%]"
                    >
                      <InvoiceCard
                        invoice={invoice}
                        isExpanded={expandedId === String(invoice.id)}
                        onToggle={() => handleToggle(String(invoice.id))}
                        onAddNote={handleAddNote}
                      />
                    </div>
                  ))
                ) : (
                  <div className="w-full text-center py-10 text-gray-500 border rounded-lg">
                    {selectedDate
                      ? `No invoices found on ${selectedDate.toDateString()}`
                      : "No Invoice found"}
                  </div>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
