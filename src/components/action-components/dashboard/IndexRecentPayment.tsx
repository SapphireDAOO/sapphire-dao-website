"use client";

import { useContext, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { formatEther, parseEther } from "viem";
import {
  ContractActionsContext,
  InvoiceStateContext,
} from "@/context/contract-context";
import { Invoice } from "@/model/model";
import {
  usePagedInvoiceQuery,
  INVOICE_PAGE_SIZE,
  sortByLastAction,
} from "@/hooks/usePagedInvoiceQuery";
import { useInvoiceTotals, type InvoiceSide } from "@/hooks/useInvoiceTotals";
import { useUsdPrice } from "@/hooks/useUsdPrice";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import DashboardView, { type RoleTab, type ViewMode } from "./DashboardView";
import type { GroupStats } from "./DashboardOverview";
import {
  ALL_GROUP,
  ALL_GROUP_ID,
  AWAITING_ACCEPTANCE_GROUP,
  groupsFor,
  matchesGroup,
} from "./statusGroups";
import AwaitingAcceptancePanel from "./AwaitingAcceptancePanel";
import { formatEthTotal, formatUsd, formatUsdTotal } from "./amounts";

const ROLE_TABS: RoleTab[] = ["all", "seller", "buyer"];

const canonicalStatus = (
  value?: string | null,
  invoice?: Pick<Invoice, "expiresAt">,
  nowMs = Date.now(),
) => {
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
    default:
      return normalized;
  }
};

// Live copies are rebuilt from events and chain reads, so they can lack
// fields only the subgraph has, like escrow; keep the fetched value for those.
const withLive = (invoice: Invoice, live?: Invoice): Invoice => {
  if (!live) return invoice;
  const merged: Record<string, unknown> = { ...invoice };
  for (const [key, value] of Object.entries(live)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as Invoice;
};

const matchesQuery = (invoice: Invoice, query: string) =>
  [
    invoice.id,
    invoice.invoiceId.toString(),
    invoice.buyer,
    invoice.seller,
    invoice.contract,
    invoice.paymentTxHash,
    invoice.releaseHash,
    invoice.refundTxHash,
  ].some((value) => value?.toLowerCase().includes(query));

export default function IndexRecentPayment({
  isIntermediatedTab,
  kindSwitch,
  primaryAction,
  notice,
  enabled = true,
}: {
  isIntermediatedTab: boolean;
  kindSwitch: React.ReactNode;
  primaryAction?: React.ReactNode;
  notice?: React.ReactNode;
  enabled?: boolean;
}) {
  const { liveInvoiceData } = useContext(InvoiceStateContext);
  const { trackInvoices } = useContext(ContractActionsContext);

  const [groupId, setGroupId] = useState(ALL_GROUP_ID);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("cards");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const params = useSearchParams();
  const paramTab = params.get("tab") as RoleTab | null;
  const defaultTab: RoleTab =
    paramTab && ROLE_TABS.includes(paramTab) ? paramTab : "all";
  const [activeTab, setActiveTab] = useState<RoleTab>(defaultTab);
  const debouncedQuery = useDebouncedValue(query, 250)
    .trim()
    .replace(/^#/, "")
    .toLowerCase();

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    setPage(1);
  }, [groupId, isIntermediatedTab, activeTab, debouncedQuery]);

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

  const { data: totalsRows, isLoading: totalsLoading } = useInvoiceTotals({
    isIntermediated: isIntermediatedTab,
    enabled,
  });
  const { data: ethUsd } = useUsdPrice("ETH");

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
    const updated = sellerInvoices.map((invoice) =>
      withLive(
        invoice,
        liveOverlay.byKey.get(`${invoiceKey(invoice)}-${invoice.type}`),
      ),
    );

    return [...liveOverlay.sellerOnly, ...updated];
  }, [invoiceKey, sellerInvoices, liveOverlay]);

  const liveBuyerInvoices = useMemo(() => {
    const updated = buyerInvoices.map((invoice) =>
      withLive(
        invoice,
        liveOverlay.byKey.get(`${invoiceKey(invoice)}-${invoice.type}`),
      ),
    );

    return [...liveOverlay.buyerOnly, ...updated];
  }, [buyerInvoices, invoiceKey, liveOverlay]);

  const allForTab = useMemo(() => {
    if (activeTab === "seller") return liveSellerInvoices;
    if (activeTab === "buyer") return liveBuyerInvoices;
    return sortByLastAction([...liveSellerInvoices, ...liveBuyerInvoices]);
  }, [activeTab, liveSellerInvoices, liveBuyerInvoices]);

  // Desktop lists invoices awaiting acceptance in the sidebar; phones keep them a tile.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const usesPanel = !isIntermediatedTab && isDesktop;

  const groups = useMemo(() => {
    const base = groupsFor(isIntermediatedTab);
    if (isIntermediatedTab || isDesktop) return [ALL_GROUP, ...base];
    const [awaitingPayment, ...rest] = base;
    return [ALL_GROUP, awaitingPayment, AWAITING_ACCEPTANCE_GROUP, ...rest];
  }, [isIntermediatedTab, isDesktop]);
  const selectedGroup =
    groups.find((group) => group.id === groupId) ?? ALL_GROUP;
  const statGroups = useMemo(
    () => (usesPanel ? [...groups, AWAITING_ACCEPTANCE_GROUP] : groups),
    [groups, usesPanel],
  );

  // Totals come from the full subgraph snapshot, with
  // live status events laid over it so they stay current.
  const stats = useMemo(() => {
    const rows = new Map<
      string,
      { side: InvoiceSide; status: string; amount: bigint }
    >();
    for (const row of totalsRows ?? []) rows.set(`${row.id}-${row.side}`, row);

    const nowMs = Date.now();
    for (const invoice of liveInvoiceData) {
      const side: InvoiceSide | null =
        invoice.type === sellerType
          ? "seller"
          : invoice.type === buyerType
            ? "buyer"
            : null;
      if (!side) continue;

      const key = `${invoiceKey(invoice)}-${side}`;
      let amount = rows.get(key)?.amount;
      if (amount === undefined) {
        try {
          amount = isIntermediatedTab
            ? BigInt(invoice.price ?? 0)
            : parseEther(invoice.price ?? "0");
        } catch {
          amount = BigInt(0);
        }
      }
      rows.set(key, {
        side,
        amount,
        status: canonicalStatus(invoice.status, invoice, nowMs),
      });
    }

    const result: Record<string, GroupStats> = {};
    for (const group of statGroups) {
      result[group.id] = { count: 0, total: BigInt(0) };
    }

    for (const row of rows.values()) {
      if (activeTab !== "all" && row.side !== activeTab) continue;
      const inPanel =
        usesPanel && matchesGroup(AWAITING_ACCEPTANCE_GROUP, row.status);
      for (const group of statGroups) {
        if (!matchesGroup(group, row.status)) continue;
        if (inPanel && group.id === ALL_GROUP_ID) continue;
        result[group.id].count += 1;
        result[group.id].total += row.amount;
      }
    }
    return result;
  }, [
    totalsRows,
    liveInvoiceData,
    sellerType,
    buyerType,
    invoiceKey,
    isIntermediatedTab,
    statGroups,
    activeTab,
    usesPanel,
  ]);

  const heroSecondary = useMemo(() => {
    if (isIntermediatedTab || !ethUsd) return undefined;
    const total = stats[selectedGroup.id]?.total;
    if (!total) return undefined;
    return `≈ ${formatUsd(Number(formatEther(total)) * ethUsd)}`;
  }, [isIntermediatedTab, ethUsd, stats, selectedGroup.id]);

  const awaitingAcceptance = useMemo(() => {
    if (!usesPanel) return [];
    const nowMs = Date.now();
    return allForTab.filter((invoice) =>
      matchesGroup(
        AWAITING_ACCEPTANCE_GROUP,
        canonicalStatus(invoice.status, invoice, nowMs),
      ),
    );
  }, [usesPanel, allForTab]);

  const filteredInvoices = useMemo(() => {
    const nowMs = Date.now();
    // Invoices awaiting acceptance live in the sidebar panel instead.
    let invoices = allForTab.filter((invoice) => {
      const status = canonicalStatus(invoice.status, invoice, nowMs);
      if (usesPanel && matchesGroup(AWAITING_ACCEPTANCE_GROUP, status)) {
        return false;
      }
      return matchesGroup(selectedGroup, status);
    });

    if (debouncedQuery) {
      invoices = invoices.filter((invoice) =>
        matchesQuery(invoice, debouncedQuery),
      );
    }

    return invoices;
  }, [allForTab, selectedGroup, debouncedQuery, usesPanel]);

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

  const handleTabChange = useCallback((value: RoleTab) => {
    setActiveTab(value);
    setPage(1);
    // Native history updates useSearchParams without remounting the page,
    // which router.replace would do, refetching every list.
    const path = window.location.pathname;
    window.history.replaceState(
      null,
      "",
      value === "all" ? path : `${path}?tab=${value}`,
    );
  }, []);

  const handleToggle = useCallback(
    (invoiceId: bigint) => {
      const id = invoiceKey({ invoiceId });
      setExpandedId((prev) => (prev === id ? null : id));
    },
    [invoiceKey],
  );

  return (
    <DashboardView
      isIntermediated={isIntermediatedTab}
      kindSwitch={kindSwitch}
      primaryAction={primaryAction}
      notice={notice}
      sidePanel={
        !usesPanel ? undefined : (
          <AwaitingAcceptancePanel
            invoices={awaitingAcceptance}
            stats={stats[AWAITING_ACCEPTANCE_GROUP.id]}
            isLoading={totalsLoading || (pageIsLoading && allForTab.length === 0)}
          />
        )
      }
      groups={groups}
      selectedGroup={selectedGroup}
      onSelectGroup={setGroupId}
      stats={stats}
      statsLoading={totalsLoading}
      formatTotal={isIntermediatedTab ? formatUsdTotal : formatEthTotal}
      unit={isIntermediatedTab ? "USD" : "ETH"}
      heroSecondary={heroSecondary}
      roleTab={activeTab}
      onRoleTab={handleTabChange}
      query={query}
      onQuery={setQuery}
      view={view}
      onView={setView}
      invoices={displayInvoices}
      isLoading={pageIsLoading}
      error={pageError}
      onRetry={refetchPage}
      expandedId={expandedId}
      onToggle={handleToggle}
      page={page}
      hasNextPage={hasNextPage}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={handleNext}
    />
  );
}
