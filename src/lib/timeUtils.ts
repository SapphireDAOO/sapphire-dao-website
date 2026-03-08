/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Calculates remaining time from a paid-at timestamp until expiry.
 * Returns a human-readable "DDd HHh MMm SSs" string, "Time Elapsed", or "-".
 */
export const timeLeft = (
  paidAtTimestamp: number | string | null,
  extra: number = 0,
  expiresAt?: number
): string => {
  if (!paidAtTimestamp || paidAtTimestamp === "Not Paid") return "-";

  const paidAtTime = Number(paidAtTimestamp) * 1000;
  const expiryTime = expiresAt ? expiresAt : paidAtTime + extra;
  const currentTime = Date.now();

  if (currentTime > expiryTime) return "Time Elapsed";

  const timeDiff = expiryTime - currentTime;
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
};

/** Converts a Unix timestamp to a "DD-Mon-YYYY HH:MM" UTC string. */
export const unixToGMT = (unixTimestamp: any): string => {
  if (!unixTimestamp) return "";
  const date = new Date(unixTimestamp * 1000);

  const monthAbbr = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = monthAbbr[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  if (!month || !Number.isFinite(year)) return "";
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};
