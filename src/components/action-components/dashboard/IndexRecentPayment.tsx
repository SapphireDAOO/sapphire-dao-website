"use client";

import { useContext, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  ContractActionsContext,
  InvoiceStateContext,
} from "@/context/contract-context";
import { FilterTabs, CreateInvoiceCard } from "./invoice-cards/index";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Invoice } from "@/model/model";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IntermediatedCard } from "./invoices/IntermediatedInvoices";
import { InvoiceCard } from "./invoices/SimpleInvoices";
import {
  usePagedInvoiceQuery,
  INVOICE_PAGE_SIZE,
  sortByLastAction,
} from "@/hooks/usePagedInvoiceQuery";
import { InvoiceFilterBar } from "./InvoiceFilterBar";
import { InvoicePaginationControls } from "./InvoicePaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const intermediatedFilters = [
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
  isIntermediatedTab,
  enabled = true,
}: {
  isIntermediatedTab: boolean;
  enabled?: boolean;
}) {
  const { liveInvoiceData } = useContext(InvoiceStateContext);
  const { trackInvoices } = useContext(ContractActionsContext);

  const [statusFilter, setStatusFilter] = useState("All");
  const [walletQuery, setWalletQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [page, setPage] = useState(1);

  const params = useSearchParams();
  const defaultTab = params.get("tab") || "all";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const debouncedWalletQuery = useDebouncedValue(walletQuery, 250)
    .trim()
    .toLowerCase();

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);


  useEffect(() => {
    setPage(1);
  }, [
    statusFilter,
    selectedDate,
    isIntermediatedTab,
    activeTab,
    debouncedWalletQuery,
  ]);

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
  } = usePagedInvoiceQuery({ isIntermediated: isIntermediatedTab, enabled });

  const invoiceKey = useCallback(
    (invoice: Pick<Invoice, "invoiceId">) => invoice.invoiceId.toString(),
    [],
  );

  // The live feed drops events for ids it can't
  // tie to this wallet, so register them.
  useEffect(() => {
    if (!enabled) return;
    return trackInvoices?.([...sellerInvoices, ...buyerInvoices]);
  }, [enabled, sellerInvoices, buyerInvoices, trackInvoices]);

  // `id` is the display nonce; status events carry the hashed invoice id.
  const sellerPagedIds = useMemo(
    () => new Set(sellerInvoices.map((invoice) => invoiceKey(invoice))),
    [invoiceKey, sellerInvoices],
  );
  const buyerPagedIds = useMemo(
    () => new Set(buyerInvoices.map((invoice) => invoiceKey(invoice))),
    [buyerInvoices, invoiceKey],
  );

  const sellerType = isIntermediatedTab ? "IssuedInvoice" : "Seller";
  const buyerType = isIntermediatedTab ? "ReceivedInvoice" : "Buyer";

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

  const allForTab = useMemo(() => {
    if (activeTab === "seller") return liveSellerInvoices;
    if (activeTab === "buyer") return liveBuyerInvoices;
    return sortByLastAction([...liveSellerInvoices, ...liveBuyerInvoices]);
  }, [activeTab, liveSellerInvoices, liveBuyerInvoices]);

  const canonicalStatus = useCallback(
    (value?: string | null, invoice?: Invoice, nowMs = Date.now()) => {
      if (!value) return "";
      const normalized = value.replace(/_/g, " ").toUpperCase().trim();

      if (
        (normalized === "AWAITING PAYMENT" ||
          normalized === "CREATED" ||
          normalized === "INITIATED") &&
        invoice?.expiresAt &&
        nowMs > Number(invoice.expiresAt) * 1000
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

    return invoices;
  }, [
    allForTab,
    statusFilter,
    canonicalStatus,
    selectedDate,
    debouncedWalletQuery,
  ]);

  const displayInvoices = useMemo(
    () =>
      filteredInvoices.slice(
        (page - 1) * INVOICE_PAGE_SIZE,
        page * INVOICE_PAGE_SIZE,
      ),
    [filteredInvoices, page],
  );

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
  ]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      setStatusFilter("All");
      setWalletQuery("");
      setPage(1);
      // Native history updates useSearchParams without remounting the page,
      // which router.replace would do, refetching every list.
      const path = window.location.pathname;
      window.history.replaceState(
        null,
        "",
        value === "all" ? path : `${path}?tab=${value}`,
      );
    },
    [],
  );

  const handleToggle = useCallback(
    (invoiceId: bigint) => {
      const id = invoiceKey({ invoiceId });
      setExpandedId((prev) => (prev === id ? null : id));
    },
    [invoiceKey],
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="container mx-auto mt-8">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="seller">
              {isIntermediatedTab ? "Issued" : "Created by me"}
            </TabsTrigger>
            <TabsTrigger value="buyer">
              {isIntermediatedTab ? "Received" : "Paid by me"}
            </TabsTrigger>
          </TabsList>

          {["all", "seller", "buyer"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {activeTab === tab && (
                <>
                  {!isIntermediatedTab && (tab === "seller" || tab === "all") && (
                    <CreateInvoiceCard />
                  )}

                  <FilterTabs
                    filters={
                      isIntermediatedTab ? intermediatedFilters : simpleFilters
                    }
                    activeFilter={statusFilter}
                    onSelect={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                  />

                  <InvoiceFilterBar
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
                          <Button variant="outline" size="sm" onClick={refetchPage}>
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
                            {isIntermediatedTab ? (
                              <IntermediatedCard
                                invoice={invoice}
                                isExpanded={expandedId === key}
                                onToggle={handleToggle}
                              />
                            ) : (
                              <InvoiceCard
                                invoice={invoice}
                                isExpanded={expandedId === key}
                                onToggle={handleToggle}
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
    </TooltipProvider>
  );
}
