// /lib/generate-link.ts
import CryptoJS from "crypto-js";

/**
 * Generate a secure encrypted link for a given invoiceId.
 * Handles bigint safely by converting to string.
 */
const generateSecureLink = (invoiceId: bigint | number | string | undefined) => {
  const secretKey = process.env.NEXT_PUBLIC_SECRET_KEY;
  if (!secretKey || !invoiceId) return "";

  try {
    // Convert BigInt to string before encryption
    const safeinvoiceId =
      typeof invoiceId === "bigint" ? invoiceId.toString() : String(invoiceId);

    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify({ invoiceId: safeinvoiceId }),
      secretKey
    ).toString();

    return encodeURIComponent(encrypted);
  } catch (err) {
    console.error("Error generating secure link:", err);
    return "";
  }
};

export default generateSecureLink;
