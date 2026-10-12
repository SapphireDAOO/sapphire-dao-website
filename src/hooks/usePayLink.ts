"use client";

import { useEffect, useMemo, useState } from "react";
import { buildPayLink } from "@/lib/payLink";

export const usePayLink = (
  invoiceId: bigint | string | number | undefined,
  path: "pay" | "checkout" = "pay",
  isMeta = false,
): string => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return useMemo(
    () => (mounted ? buildPayLink(invoiceId, path, isMeta) : ""),
    [mounted, invoiceId, path, isMeta],
  );
};
