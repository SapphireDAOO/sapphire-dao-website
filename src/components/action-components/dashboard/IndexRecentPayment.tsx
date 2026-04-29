"use client";

import { useContext, useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ContractContext } from "@/context/contract-context";
import { FilterTabs, CreateInvoiceCard } from "./invoice-cards/index";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Note, Invoice } from "@/model/model";
import { Button } from "@/components/ui/button";
import { MarketplaceCard } from "./invoices/AdvancedInvoices";
import { InvoiceCard } from "./invoices/SimpleInvoices";
import { toast } from "sonner";
import {
  usePagedInvoiceQuery,
  INVOICE_PAGE_SIZE,
  sortByLastAction,
} from "@/hooks/usePagedInvoiceQuery";
import { InvoiceFilterBar } from "./InvoiceFilterBar";
import { InvoicePaginationControls } from "./InvoicePaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const marketplaceFilters = [
  "All",
  "AWAITING PAYMENT",
  "PAID",
  "REFUNDED",
  "CANCELED",
  "DISPUTED",
  "DISPUTE RESOLVED",
  "DISPUTE DISMISSED",
  "DISPUTE SETTLED",
  "RELEASED",
];

const simpleFilters = [
  "All",
  "AWAITING PAYMENT",
  "PAID",
  "ACCEPTED",
  "REFUNDED",
  "CANCELED",
  "RELEASED",
  "EXPIRED",
];

export default function IndexRecentPayment({
  isMarketplaceTab,
  enabled = true,
}: {
  isMarketplaceTab: boolean;
  enabled?: boolean;
}) {
  const {
    liveInvoiceData,
    refetchInvoiceData,
    loadNextPage: loadContextNextPage,
  } = useContext(ContractContext);

  // ── All state declarations BEFORE any derived state ──────────────────────
  const [statusFilter, setStatusFilter] = useState("All");
  const [walletQuery, setWalletQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [noteQuery, setNoteQuery] = useState("");
  const [page, setPage] = useState(1);
  // localNotes MUST be declared before displayInvoices useMemo that references it
  const [localNotes, setLocalNotes] = useState<Record<string, Note[]>>({});

  const params = useSearchParams();
  const router = useRouter();
  const defaultTab = params.get("tab") || "all";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const debouncedNoteQuery = useDebouncedValue(noteQuery, 250);
  const debouncedWalletQuery = useDebouncedValue(walletQuery, 250)
    .trim()
    .toLowerCase();

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const basePath = isMarketplaceTab ? "/marketplace-dashboard" : "/dashboard";

  // Reset to page 1 on any filter/tab change
  useEffect(() => {
    setPage(1);
  }, [
    statusFilter,
    selectedDate,
    isMarketplaceTab,
    activeTab,
    debouncedNoteQuery,
    debouncedWalletQuery,
  ]);

  // ── Subgraph hook: loads BOTH seller + buyer on mount, no re-query on tab switch
  const {
    sellerInvoices,
    buyerInvoices,
    hasMoreSeller,
    hasMoreBuyer,
    loadMoreSeller,
    loadMoreBuyer,
    isLoading: pageIsLoading,
    error: pageError,
    refetch: refetchPage,
  } = usePagedInvoiceQuery({ isMarketplace: isMarketplaceTab, enabled });

  const invoiceKey = useCallback(
    (invoice: Pick<Invoice, "invoiceId">) => invoice.invoiceId.toString(),
    [],
  );

  // Dedup by contract invoice id. `id` is the display nonce and does not match
  // status events, which emit the hashed uint216 invoice id.
  const sellerPagedIds = useMemo(
    () => new Set(sellerInvoices.map((invoice) => invoiceKey(invoice))),
    [invoiceKey, sellerInvoices],
  );
  const buyerPagedIds = useMemo(
    () => new Set(buyerInvoices.map((invoice) => invoiceKey(invoice))),
    [buyerInvoices, invoiceKey],
  );

  const sellerType = isMarketplaceTab ? "IssuedInvoice" : "Seller";
  const buyerType = isMarketplaceTab ? "ReceivedInvoice" : "Buyer";

  // ── Merge recent live updates from context on top of paged subgraph data ───
  const liveOverlay = useMemo(() => {
    const byKey = new Map<string, Invoice>();
    const sellerOnly: Invoice[] = [];
    const buyerOnly: Invoice[] = [];

    for (const invoice of liveInvoiceData) {
      const key = `${invoiceKey(invoice)}-${invoice.type}`;
      byKey.set(key, invoice);

      if (
        invoice.type === sellerType &&
        !sellerPagedIds.has(invoiceKey(invoice))
      ) {
        sellerOnly.push(invoice);
      }
      if (
        invoice.type === buyerType &&
        !buyerPagedIds.has(invoiceKey(invoice))
      ) {
        buyerOnly.push(invoice);
      }
    }

    return { byKey, sellerOnly, buyerOnly };
  }, [
    liveInvoiceData,
    sellerType,
    buyerType,
    sellerPagedIds,
    buyerPagedIds,
    invoiceKey,
  ]);

  // Also surface invoices that only exist in context (e.g. just-created or
  // just-paid invoices not yet indexed by the subgraph).
  const liveSellerInvoices = useMemo(() => {
    const updated = sellerInvoices.map((invoice) => {
      return (
        liveOverlay.byKey.get(`${invoiceKey(invoice)}-${invoice.type}`) ??
        invoice
      );
    });

    return [...liveOverlay.sellerOnly, ...updated];
  }, [invoiceKey, sellerInvoices, liveOverlay]);

  const liveBuyerInvoices = useMemo(() => {
    const updated = buyerInvoices.map((invoice) => {
      return (
        liveOverlay.byKey.get(`${invoiceKey(invoice)}-${invoice.type}`) ??
        invoice
      );
    });

    return [...liveOverlay.buyerOnly, ...updated];
  }, [buyerInvoices, invoiceKey, liveOverlay]);

  // ── Tab selection filters in-memory (no new subgraph query) ───────────────
  const allForTab = useMemo(() => {
    if (activeTab === "seller") return liveSellerInvoices;
    if (activeTab === "buyer") return liveBuyerInvoices;
    // "all": merge both and sort newest-first
    return sortByLastAction([...liveSellerInvoices, ...liveBuyerInvoices]);
  }, [activeTab, liveSellerInvoices, liveBuyerInvoices]);

  const canonicalStatus = useCallback(
    (value?: string | null, invoice?: Invoice, nowMs = Date.now()) => {
      if (!value) return "";
      const normalized = value.replace(/_/g, " ").toUpperCase().trim();

      // Dynamically detect expired: awaiting payment past invalidateAt
      if (
        (normalized === "AWAITING PAYMENT" ||
          normalized === "CREATED" ||
          normalized === "INITIATED") &&
        invoice?.invalidateAt &&
        nowMs > Number(invoice.invalidateAt) * 1000
      ) {
        return "EXPIRED";
      }

      switch (normalized) {
        case "CREATED":
        case "INITIATED":
          return "AWAITING PAYMENT";
        case "REJECTED":
          return "REFUNDED";
        case "CANCELED":
          return "CANCELED";
        default:
          return normalized;
      }
    },
    [],
  );

  // ── Client-side filters applied to the in-memory page data ───────────────
  const filteredInvoices = useMemo(() => {
    let invoices = allForTab;

    if (statusFilter !== "All") {
      const targetStatus = canonicalStatus(statusFilter);
      const nowMs = Date.now();
      invoices = invoices.filter((invoice) => {
        return canonicalStatus(invoice.status, invoice, nowMs) === targetStatus;
      });
    }

    if (debouncedWalletQuery) {
      invoices = invoices.filter(
        (invoice) =>
          invoice.buyer?.toLowerCase().includes(debouncedWalletQuery) ||
          invoice.seller?.toLowerCase().includes(debouncedWalletQuery),
      );
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

    const noteSearch = debouncedNoteQuery.trim().toLowerCase();
    if (noteSearch) {
      invoices = invoices.filter((inv) => {
        const messages = [
          ...(inv.notes?.map((n) => n.message) ?? []),
          ...(localNotes[inv.id]?.map((n) => n.message) ?? []),
        ];
        return messages.some(
          (msg) => msg && msg.toLowerCase().includes(noteSearch),
        );
      });
    }

    return invoices;
  }, [
    allForTab,
    statusFilter,
    canonicalStatus,
    selectedDate,
    debouncedNoteQuery,
    debouncedWalletQuery,
    localNotes,
  ]);

  // ── Client-side pagination over the filtered set ──────────────────────────
  const displayInvoices = useMemo(() => {
    const pageInvoices = filteredInvoices.slice(
      (page - 1) * INVOICE_PAGE_SIZE,
      page * INVOICE_PAGE_SIZE,
    );

    return pageInvoices.map((invoice) => {
      const notes = localNotes[invoiceKey(invoice)];
      if (!notes?.length) return invoice;

      return {
        ...invoice,
        notes: [...(invoice.notes || []), ...notes],
      };
    });
  }, [filteredInvoices, invoiceKey, page, localNotes]);

  const hasNextPageInMemory =
    page * INVOICE_PAGE_SIZE < filteredInvoices.length;

  const hasMoreFromSubgraph = useMemo(() => {
    if (activeTab === "seller") return hasMoreSeller;
    if (activeTab === "buyer") return hasMoreBuyer;
    return hasMoreSeller || hasMoreBuyer;
  }, [activeTab, hasMoreSeller, hasMoreBuyer]);

  const hasNextPage = hasNextPageInMemory || hasMoreFromSubgraph;

  const handleNext = useCallback(() => {
    const nextPage = page + 1;
    // If the next page would exceed what we have cached, pull more from subgraph
    if (
      (nextPage - 1) * INVOICE_PAGE_SIZE >= allForTab.length &&
      hasMoreFromSubgraph
    ) {
      if (activeTab === "seller") {
        loadMoreSeller();
      } else if (activeTab === "buyer") {
        loadMoreBuyer();
      } else {
        if (hasMoreSeller) loadMoreSeller();
        if (hasMoreBuyer) loadMoreBuyer();
      }
      // Also advance the context-level page so invoiceData stays in sync
      loadContextNextPage?.();
    }
    setPage(nextPage);
  }, [
    page,
    allForTab.length,
    hasMoreFromSubgraph,
    activeTab,
    loadMoreSeller,
    loadMoreBuyer,
    hasMoreSeller,
    hasMoreBuyer,
    loadContextNextPage,
  ]);

  // refreshInvoicesData might not be needed, refresh should only happen after reload
  // websocket should use the current data
  const refreshInvoices = useCallback(async () => {
    try {
      await Promise.all([refetchInvoiceData?.(), refetchPage()]);
    } catch (err) {
      console.error("Failed to refresh invoices", err);
      toast.error("Unable to load invoices. Please try again.");
    }
  }, [refetchInvoiceData, refetchPage]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      setStatusFilter("All");
      setWalletQuery("");
      setNoteQuery("");
      setPage(1);
      router.replace(value === "all" ? basePath : `${basePath}?tab=${value}`, {
        scroll: false,
      });
    },
    [router, basePath],
  );

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

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

  return (
    <div className="container mx-auto mt-8">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="seller">
            {isMarketplaceTab ? "Issued" : "Created by me"}
          </TabsTrigger>
          <TabsTrigger value="buyer">
            {isMarketplaceTab ? "Received" : "Paid by me"}
          </TabsTrigger>
        </TabsList>

        {["all", "seller", "buyer"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {activeTab === tab && (
              <>
                {!isMarketplaceTab && (tab === "seller" || tab === "all") && (
                  <CreateInvoiceCard />
                )}

                <FilterTabs
                  filters={
                    isMarketplaceTab ? marketplaceFilters : simpleFilters
                  }
                  activeFilter={statusFilter}
                  onSelect={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                />

                <InvoiceFilterBar
                  noteQuery={noteQuery}
                  onNoteQueryChange={setNoteQuery}
                  walletQuery={walletQuery}
                  onWalletQueryChange={setWalletQuery}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                />

                <div className="flex flex-wrap gap-5">
                  {pageIsLoading && displayInvoices.length === 0 ? (
                    <div className="w-full text-center py-10 text-gray-500 border rounded-lg">
                      <span className="animate-pulse">Loading...</span>
                    </div>
                  ) : pageError && displayInvoices.length === 0 ? (
                    <div className="w-full text-center py-10 text-gray-500 border rounded-lg">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-sm text-gray-600">
                          {pageError}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshInvoices}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : displayInvoices.length > 0 ? (
                    displayInvoices.map((invoice) => {
                      const key = invoiceKey(invoice);

                      return (
                        <div
                          key={`${key}-${invoice.type}`}
                          className="w-full md:w-[48%] lg:w-[31%]"
                        >
                          {isMarketplaceTab ? (
                            <MarketplaceCard
                              invoice={invoice}
                              isExpanded={expandedId === key}
                              onToggle={() => handleToggle(key)}
                              onAddNote={handleAddNote}
                            />
                          ) : (
                            <InvoiceCard
                              invoice={invoice}
                              isExpanded={expandedId === key}
                              onToggle={() => handleToggle(key)}
                            />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full text-center py-10 text-gray-500 border rounded-lg">
                      <span>
                        {selectedDate
                          ? `No invoices found on ${selectedDate.toDateString()}`
                          : "No invoices found"}
                      </span>
                    </div>
                  )}
                </div>

                <InvoicePaginationControls
                  page={page}
                  hasNextPage={hasNextPage}
                  isLoading={pageIsLoading}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={handleNext}
                />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
