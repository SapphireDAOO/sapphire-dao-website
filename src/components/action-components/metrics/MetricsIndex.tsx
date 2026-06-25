"use client";

import { ArrowUpDown, Wallet, DollarSign, Receipt, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMetricsData } from "@/hooks/useMetricsData";
import type { MetricValue } from "@/services/metrics/types";
import { MetricCard } from "./MetricCard";
import { VolumeChart } from "./VolumeChart";
import { EscrowChart } from "./EscrowChart";
import { InvoiceActivityChart } from "./InvoiceActivityChart";
import { WalletBalances } from "./WalletBalances";
import { UserMetrics } from "./UserMetrics";
import { RecentTransactions } from "./RecentTransactions";
import { GasTracker } from "./GasTracker";
import { SystemHealth } from "./SystemHealth";
import { PaidTransactionsModal } from "./PaidTransactionsModal";
import { EscrowTransactionsModal } from "./EscrowTransactionsModal";
import { InvoicesPaidModal } from "./InvoicesPaidModal";
import { FeesPaidModal } from "./FeesPaidModal";
import {
  formatUsd,
  formatCount,
  METRIC_PLACEHOLDER,
} from "./formatMetric";

/** Live status dot mirroring the websocket transport state. */
const LiveIndicator = ({ status }: { status: string }) => {
  const isLive = status === "open";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40",
        )}
      />
      {isLive ? "Live" : "Offline"}
    </span>
  );
};

export default function MetricsIndex() {
  const { snapshot, isLoading, error, socketStatus, refetch } =
    useMetricsData();

  // Render the formatted value, or a placeholder dash when no snapshot yet.
  const show = (
    metric: MetricValue | undefined,
    format: (n: number) => string,
  ) => (metric ? format(metric.value) : METRIC_PLACEHOLDER);

  const change = (metric: MetricValue | undefined) =>
    metric ? metric.changePct : undefined;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
            <p className="text-sm text-muted-foreground">
              Protocol activity across the simple and advanced payment
              processors.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator status={socketStatus} />
            <button
              type="button"
              onClick={refetch}
              aria-label="Refresh metrics"
              className="rounded-md border border-border p-2 text-muted-foreground transition hover:text-foreground"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <PaidTransactionsModal>
            <button
              type="button"
              aria-label="View payments in the last 30 days"
              className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MetricCard
                title="Total Volume (30d)"
                value={show(snapshot?.totalVolume, formatUsd)}
                change={change(snapshot?.totalVolume)}
                changeLabel="vs last month"
                icon={<ArrowUpDown className="h-4 w-4" />}
                isLoading={isLoading}
                actionLabel="View payments"
              />
            </button>
          </PaidTransactionsModal>
          <EscrowTransactionsModal>
            <button
              type="button"
              aria-label="View escrow movements in the last 30 days"
              className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MetricCard
                title="Escrow Balance"
                value={show(snapshot?.escrowBalance, formatUsd)}
                change={change(snapshot?.escrowBalance)}
                changeLabel="vs yesterday"
                icon={<Wallet className="h-4 w-4" />}
                isLoading={isLoading}
                actionLabel="View escrow movements"
              />
            </button>
          </EscrowTransactionsModal>
          <FeesPaidModal>
            <button
              type="button"
              aria-label="View fees paid in the last 30 days"
              className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MetricCard
                title="Fees Paid (30d)"
                value={show(snapshot?.feesPaid, formatUsd)}
                change={change(snapshot?.feesPaid)}
                changeLabel="vs last month"
                icon={<DollarSign className="h-4 w-4" />}
                isLoading={isLoading}
                actionLabel="View fees paid"
              />
            </button>
          </FeesPaidModal>
          <InvoicesPaidModal>
            <button
              type="button"
              aria-label="View invoices paid in the last 7 days"
              className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MetricCard
                title="Invoices Paid (7d)"
                value={show(snapshot?.invoicesPaid, formatCount)}
                change={change(snapshot?.invoicesPaid)}
                changeLabel="vs last week"
                icon={<Receipt className="h-4 w-4" />}
                isLoading={isLoading}
                actionLabel="View invoices paid"
              />
            </button>
          </InvoicesPaidModal>
        </section>

        <section className="mt-6">
          <VolumeChart
            series={snapshot?.volumeSeries ?? []}
            isLoading={isLoading}
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <EscrowChart
            series={snapshot?.escrowSeries ?? []}
            isLoading={isLoading}
          />
          <InvoiceActivityChart
            series={snapshot?.invoiceActivitySeries ?? []}
            isLoading={isLoading}
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <WalletBalances />
          <UserMetrics
            data={snapshot?.userMetrics}
            isLoading={isLoading}
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentTransactions />
          <div className="space-y-6">
            <GasTracker />
            <SystemHealth />
          </div>
        </section>
      </main>
    </div>
  );
}
