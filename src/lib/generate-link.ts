// /lib/generate-link.ts
import CryptoJS from "crypto-js";

/**
 * Generate a secure encrypted link for a given orderId.
 * Handles bigint safely by converting to string.
 */
const generateSecureLink = (orderId: bigint | number | string | undefined) => {
  const secretKey = process.env.NEXT_PUBLIC_SECRET_KEY;
  if (!secretKey || !orderId) return "";

  try {
    // Convert BigInt to string before encryption
    const safeOrderId =
      typeof orderId === "bigint" ? orderId.toString() : String(orderId);

    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify({ orderId: safeOrderId }),
      secretKey
    ).toString();

    return encodeURIComponent(encrypted);
  } catch (err) {
    console.error("Error generating secure link:", err);
    return "";
  }
};

export default generateSecureLink;
