import { useState, useEffect } from "react";

/**
 * Generates a signed JWT pay link for the given orderId by calling the
 * server-side /api/generate-pay-link endpoint. This keeps the signing key
 * out of the browser bundle.
 *
 * Returns the full URL (e.g. "https://…/pay/?data=<token>") or "" while loading.
 */
export function useSecureLink(
  orderId: bigint | string | number | undefined,
  path: "pay" | "checkout" = "pay"
): string {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (orderId === undefined || orderId === null || orderId === "") {
      setUrl("");
      return;
    }

    const safeId =
      typeof orderId === "bigint" ? orderId.toString() : String(orderId);

    let cancelled = false;

    fetch("/api/generate-pay-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: safeId }),
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
  }, [orderId, path]);

  return url;
}