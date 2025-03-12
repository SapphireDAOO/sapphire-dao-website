/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Calculates the remaining time from a given "paid at" timestamp plus extra milliseconds
 * until the current time. Returns a human-readable string in the format of:
 *   "DDd HHh MMm SSs"
 * or "Time Elapsed" if the target time has already passed, or "-" if not paid.
 * @returns A formatted string of the remaining time or a fallback message.
 */
export const timeLeft = (paidAtTimestamp: any, extra: number = 0) => {
  if (paidAtTimestamp === "Not Paid" || paidAtTimestamp == null) {
    return "-";
  }

  const paidAtTime = paidAtTimestamp * 1000;

  const daysLater = paidAtTime + extra;

  const currentTime = Date.now();
  if (currentTime > daysLater) {
    return "Time Elapsed";
  }

  const timeDiff = daysLater - currentTime;

  const days = Math.floor(timeDiff / 86400000);
  const hours = Math.floor((timeDiff % 86400000) / 3600000);
  const minutes = Math.floor((timeDiff % 3600000) / 60000);
  const seconds = Math.floor((timeDiff % 60000) / 1000);

  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(
    2,
    "0"
  )}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(
    2,
    "0"
  )}s`;
};
