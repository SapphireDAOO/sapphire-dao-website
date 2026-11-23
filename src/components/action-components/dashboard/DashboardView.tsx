"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Invoice } from "@/model/model";
import { IntermediatedCard } from "./invoices/IntermediatedInvoices";
import { InvoiceCard } from "./invoices/SimpleInvoices";
import { InvoicePaginationControls } from "./InvoicePaginationControls";
import {
  SegmentedControl,
  StatusHero,
  StatusTiles,
  type GroupStats,
} from "./DashboardOverview";
import type { StatusGroup } from "./statusGroups";

export type RoleTab = "all" | "seller" | "buyer";
export type ViewMode = "cards" | "list";

const SearchField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="relative block w-full">
    <Search
      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search invoices"
      aria-label="Search invoices by id, address or transaction"
      className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10 md:h-11"
    />
  </label>
);

const ListMessage = ({ children }: { children: React.ReactNode }) => (
  <div className="col-span-full border border-dashed border-border bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground">
    {children}
  </div>
);

export default function DashboardView({
  isIntermediated,
  kindSwitch,
  primaryAction,
  notice,
  sidePanel,
  groups,
  selectedGroup,
  onSelectGroup,
  stats,
  statsLoading,
  formatTotal,
  unit,
  heroSecondary,
  roleTab,
  onRoleTab,
  query,
  onQuery,
  view,
  onView,
  invoices,
  isLoading,
  error,
  onRetry,
  expandedId,
  onToggle,
  page,
  hasNextPage,
  onPrev,
  onNext,
}: {
  isIntermediated: boolean;
  kindSwitch: React.ReactNode;
  primaryAction?: React.ReactNode;
  notice?: React.ReactNode;
  sidePanel?: React.ReactNode;
  groups: StatusGroup[];
  selectedGroup: StatusGroup;
  onSelectGroup: (id: string) => void;
  stats: Record<string, GroupStats>;
  statsLoading: boolean;
  formatTotal: (value: bigint) => string;
  unit: string;
  heroSecondary?: string;
  roleTab: RoleTab;
  onRoleTab: (tab: RoleTab) => void;
  query: string;
  onQuery: (value: string) => void;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  expandedId: string | null;
  onToggle: (invoiceId: bigint) => void;
  page: number;
  hasNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const description = selectedGroup.description ? (
    <p className="text-xs leading-5 text-muted-foreground" aria-live="polite">
      {selectedGroup.description}
    </p>
  ) : null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex-1 md:grid md:grid-cols-[minmax(0,1fr)_minmax(15rem,25%)]">
        <div className="min-w-0 px-4 pb-10 pt-5 sm:px-8 md:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {kindSwitch}
            {primaryAction}
          </div>

          {notice}

          <div className="mt-4 md:hidden">
            <SearchField value={query} onChange={onQuery} />
          </div>

          <div className="mt-6 md:mt-8">
            <StatusHero
              group={selectedGroup}
              stats={stats[selectedGroup.id]}
              formatTotal={formatTotal}
              unit={unit}
              secondary={heroSecondary}
              isLoading={statsLoading}
            />
          </div>

          <div className="mt-6">
            <StatusTiles
              groups={groups}
              selectedId={selectedGroup.id}
              stats={stats}
              formatTotal={formatTotal}
              unit={unit}
              isLoading={statsLoading}
              onSelect={onSelectGroup}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl<RoleTab>
              ariaLabel="Whose invoices"
              value={roleTab}
              onChange={onRoleTab}
              options={[
                { value: "all", label: "All" },
                {
                  value: "seller",
                  label: isIntermediated ? "Issued" : "Created by me",
                },
                {
                  value: "buyer",
                  label: isIntermediated ? "Received" : "Paid by me",
                },
              ]}
            />
            <SegmentedControl<ViewMode>
              ariaLabel="Invoice display"
              value={view}
              onChange={onView}
              options={[
                {
                  value: "cards",
                  label: (
                    <>
                      <LayoutGrid className="size-3.5" aria-hidden="true" />
                      Cards
                    </>
                  ),
                },
                {
                  value: "list",
                  label: (
                    <>
                      <List className="size-3.5" aria-hidden="true" />
                      List
                    </>
                  ),
                },
              ]}
            />
          </div>

          <div
            className={cn(
              "mt-3 grid grid-cols-1 items-start",
              view === "cards" ? "gap-4 lg:grid-cols-2" : "gap-3",
            )}
          >
            {isLoading && invoices.length === 0 ? (
              <ListMessage>
                <span className="animate-pulse">Loading invoices…</span>
              </ListMessage>
            ) : error && invoices.length === 0 ? (
              <ListMessage>
                <span className="block">{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-none"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              </ListMessage>
            ) : invoices.length === 0 ? (
              <ListMessage>
                <span className="block font-medium text-foreground">
                  No matching invoices
                </span>
                <span className="mt-1 block">
                  Try a different status or search term.
                </span>
              </ListMessage>
            ) : (
              invoices.map((invoice) => {
                const key = invoice.invoiceId.toString();
                const Card = isIntermediated ? IntermediatedCard : InvoiceCard;
                return (
                  <Card
                    key={`${key}-${invoice.type}`}
                    invoice={invoice}
                    isExpanded={expandedId === key}
                    onToggle={onToggle}
                  />
                );
              })
            )}
          </div>

          <InvoicePaginationControls
            page={page}
            hasNextPage={hasNextPage}
            isLoading={isLoading}
            onPrev={onPrev}
            onNext={onNext}
          />
        </div>

        <aside className="hidden border-l border-border md:block md:px-4 md:py-8 lg:px-7">
          <div className="sticky top-8 flex flex-col gap-5">
            <SearchField value={query} onChange={onQuery} />
            {sidePanel}
            {description}
          </div>
        </aside>
      </div>

      {description && (
        <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-8 md:hidden">
          {description}
        </div>
      )}
    </TooltipProvider>
  );
}
