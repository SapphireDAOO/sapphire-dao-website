"use client";

import { useEffect, useMemo, useState } from "react";
import { buildPayLink } from "@/lib/payLink";

/**
 * The shareable pay/checkout URL for an invoice.
 *
 * Built in the browser from the invoice id rather than fetched, so it costs no
 * request and cannot fail. It stays empty for the first render because
 * `window.location.origin` is not available while server-rendering, and a URL
 * that appeared during hydration would make the first client render disagree
 * with the server markup. That is one tick, where the previous version waited
 * on a round trip.
 */
export const usePayLink = (
  invoiceId: bigint | string | number | undefined,
  path: "pay" | "checkout" = "pay",
): string => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return useMemo(
    () => (mounted ? buildPayLink(invoiceId, path) : ""),
    [mounted, invoiceId, path],
  );
};
