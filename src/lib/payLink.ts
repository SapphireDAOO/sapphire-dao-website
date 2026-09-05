/** Query parameter carrying the encoded invoice id. */
export const PAY_LINK_PARAM = "id";

const MAX_UINT216 = (BigInt(1) << BigInt(216)) - BigInt(1);

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const fromBase64Url = (value: string): Uint8Array | null => {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};

const toInvoiceId = (value: bigint | string | number): bigint | null => {
  try {
    const id = typeof value === "bigint" ? value : BigInt(String(value).trim());
    return id >= BigInt(0) && id <= MAX_UINT216 ? id : null;
  } catch {
    return null;
  }
};

/** Encodes an invoice id for a pay link. Returns "" for anything unusable. */
export const encodeInvoiceId = (
  invoiceId: bigint | string | number | undefined | null,
): string => {
  if (invoiceId === undefined || invoiceId === null || invoiceId === "") {
    return "";
  }

  const id = toInvoiceId(invoiceId);
  if (id === null) return "";

  let hex = id.toString(16);
  if (hex.length % 2) hex = `0${hex}`;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return toBase64Url(bytes);
};

/**
 * Reads an invoice id back out of a pay link. Returns null for anything that
 * is not a well-formed id, so a mangled or hand-edited link fails closed
 * rather than sending the payer to a nonsense invoice.
 */
export const decodeInvoiceId = (encoded: string | null): string | null => {
  if (!encoded) return null;

  const bytes = fromBase64Url(encoded);
  if (!bytes || bytes.length === 0 || bytes.length > 27) return null;

  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");

  const id = toInvoiceId(BigInt(`0x${hex}`));
  return id === null ? null : id.toString();
};

/**
 * The shareable URL for an invoice. Built entirely in the browser, so it is
 * ready on first render rather than after a request settles.
 */
export const buildPayLink = (
  invoiceId: bigint | string | number | undefined | null,
  path: "pay" | "checkout" = "pay",
): string => {
  const encoded = encodeInvoiceId(invoiceId);
  if (!encoded || typeof window === "undefined") return "";

  return `${window.location.origin}/${path}/?${PAY_LINK_PARAM}=${encoded}`;
};
