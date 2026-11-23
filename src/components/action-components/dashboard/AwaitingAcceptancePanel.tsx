"use client";

import { Clock } from "lucide-react";
import { Invoice } from "@/model/model";
import SellersAction from "./invoices-components/SellersAction";
import { Countdown, SectionLabel } from "./invoices/InvoiceCardFrame";
import { formatEthTotal } from "./amounts";
import type { GroupStats } from "./DashboardOverview";

export default function AwaitingAcceptancePanel({
  invoices,
  stats,
  isLoading,
}: {
  invoices: Invoice[];
  stats?: GroupStats;
  isLoading: boolean;
}) {
  const count = stats?.count ?? invoices.length;

  return (
    <section
      aria-labelledby="awaiting-acceptance-title"
      className="border border-border bg-card shadow-sm"
    >
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-warning"
              aria-hidden="true"
            />
            <span id="awaiting-acceptance-title">
              <SectionLabel>Awaiting acceptance</SectionLabel>
            </span>
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {isLoading ? "–" : count}
          </span>
        </div>
        {!isLoading && stats && stats.count > 0 && (
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-semibold tabular-nums">
              {formatEthTotal(stats.total)}
            </span>
            <span className="text-xs text-muted-foreground">ETH</span>
          </p>
        )}
      </header>

      {invoices.length === 0 ? (
        <p className="px-4 py-4 text-xs leading-5 text-muted-foreground">
          {isLoading
            ? "Loading…"
            : "Nothing is waiting to be accepted. Paid invoices show here until the seller accepts or rejects them."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {invoices.map((invoice) => (
            <li
              key={`${invoice.invoiceId.toString()}-${invoice.type}`}
              className="space-y-2.5 px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  #{invoice.id}
                </span>
                <span className="flex items-baseline gap-1 font-mono text-sm font-semibold tabular-nums">
                  {invoice.price}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    ETH
                  </span>
                </span>
              </div>
              {invoice.sellerActionDeadline && (
                <p className="flex items-center gap-1.5 text-xs text-warning-foreground">
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-mono tabular-nums">
                    <Countdown startAt={Number(invoice.sellerActionDeadline)} />
                  </span>
                  <span>left to decide</span>
                </p>
              )}
              {invoice.type === "Seller" ? (
                <div className="grid grid-cols-2 gap-2">
                  <SellersAction
                    invoiceId={invoice.invoiceId}
                    state={false}
                    text="Reject"
                    fullWidth
                  />
                  <SellersAction
                    invoiceId={invoice.invoiceId}
                    state
                    text="Accept"
                    fullWidth
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  You paid this. Waiting for the seller to accept.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
