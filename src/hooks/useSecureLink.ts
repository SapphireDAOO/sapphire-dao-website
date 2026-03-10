import { useState, useEffect } from "react";

/**
 * Generates a signed JWT pay link for the given invoiceId by calling the
 * server-side /api/generate-pay-link endpoint. This keeps the signing key
 * out of the browser bundle.
 *
 * Returns the full URL (e.g. "https://…/pay/?data=<token>") or "" while loading.
 */
export function useSecureLink(
  invoiceId: bigint | string | number | undefined,
  path: "pay" | "checkout" = "pay"
): string {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (invoiceId === undefined || invoiceId === null || invoiceId === "") {
      setUrl("");
      return;
    }

    const safeId =
      typeof invoiceId === "bigint" ? invoiceId.toString() : String(invoiceId);

    let cancelled = false;

    fetch("/api/generate-pay-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: safeId }),
    })
      .then((r) => r.json())
      .then(({ token }: { token?: string }) => {
        if (cancelled || !token) return;
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        setUrl(`${origin}/${path}/?data=${encodeURIComponent(token)}`);
      })
      .catch(() => {
        if (!cancelled) setUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [invoiceId, path]);

  return url;
}