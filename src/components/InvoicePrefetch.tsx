"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { takeRememberedAccount } from "@/lib/rememberedAccount";
import { readSession } from "@/services/auth";
import { prefetchInvoicePages } from "@/hooks/usePagedInvoiceQuery";
import { invoiceTotalsQuery } from "@/hooks/useInvoiceTotals";

/**
 * Starts the dashboard's queries for the remembered wallet while it
 * reconnects, so the invoices are ready when the sign-in gate opens.
 */
const InvoicePrefetch = () => {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  useEffect(() => {
    const isIntermediated =
      pathname?.startsWith("/intermediated-dashboard") ?? false;
    if (!isIntermediated && !pathname?.startsWith("/dashboard")) return;

    const remembered = takeRememberedAccount();
    if (!remembered || !readSession(remembered.address)) return;
    const { address, chainId } = remembered;
    void prefetchInvoicePages(chainId, address, isIntermediated);
    void queryClient.prefetchQuery(
      invoiceTotalsQuery(chainId, address, isIntermediated),
    );
  }, [queryClient, pathname]);

  return null;
};

export default InvoicePrefetch;
