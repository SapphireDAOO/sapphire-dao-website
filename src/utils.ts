/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Calculates the remaining time from a given "paid at" timestamp plus extra milliseconds
 * until the current time. Returns a human-readable string in the format of:
 *   "DDd HHh MMm SSs"
 * or "Time Elapsed" if the target time has already passed, or "-" if not paid.
 * @returns A formatted string of the remaining time or a fallback message.
 */
export const timeLeft = (
  paidAtTimestamp: number | string | null,
  extra: number = 0,
  expiresAt?: number
) => {
  if (!paidAtTimestamp || paidAtTimestamp === "Not Paid") {
    return "-";
  }

  const paidAtTime = Number(paidAtTimestamp) * 1000;
  const expiryTime = expiresAt ? expiresAt : paidAtTime + extra;

  const currentTime = Date.now();

  if (currentTime > expiryTime) {
    return "Time Elapsed";
  }

  const timeDiff = expiryTime - currentTime;
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(
    2,
    "0"
  )}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(
    2,
    "0"
  )}s`;
};
export const formatAddress = (address: string) => {
  return `${address.slice(0, 4)}..${address.slice(-3)}`;
};

export const unixToGMT = (unixTimestamp: any) => {
  if (!unixTimestamp) return "";
  const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds

  // Define month abbreviations
  const monthAbbr = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Extract parts in GMT
  const day = String(date.getUTCDate()).padStart(2, "0");

  const month = monthAbbr[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  if (!month || !Number.isFinite(year)) return "";

  return `${day}-${month}-${year} ${hours}:${minutes}`;
};
