// Chooses which fee receivers a sweep draws from. Kept free of network and
// chain access so it stays directly testable.

import type { FeeReceiverBalance, SweepPlan, SweepSource } from "@/model/fees";

/**
 * Smallest balance first, address as the tie-break so a plan is stable across
 * reloads. Draining the smallest receivers first keeps the long tail of dust
 * accounts from growing without bound.
 */
export const compareReceivers = (
  a: FeeReceiverBalance,
  b: FeeReceiverBalance,
): number => {
  if (a.balance !== b.balance) return a.balance < b.balance ? -1 : 1;
  return a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1;
};

/**
 * Picks receivers to cover `requested`, taking each one's whole balance until
 * the last, which is drawn from only as far as needed so the sweep totals
 * exactly the requested amount. With balances of 50 and 70 and a request of
 * 100, the 50 is emptied and 50 is taken from the 70, leaving 20 behind.
 *
 * `shortfall` is non-zero when the receivers cannot cover the request; the
 * sources returned then represent everything that is available.
 */
export const planSweep = (
  receivers: FeeReceiverBalance[],
  requested: bigint,
): SweepPlan => {
  const sources: SweepSource[] = [];
  let remaining = requested;

  if (requested > BigInt(0)) {
    for (const receiver of [...receivers].sort(compareReceivers)) {
      if (remaining <= BigInt(0)) break;
      if (receiver.balance <= BigInt(0)) continue;

      const amount =
        receiver.balance < remaining ? receiver.balance : remaining;
      sources.push({
        address: receiver.address,
        amount,
        available: receiver.balance,
        drained: amount === receiver.balance,
      });
      remaining -= amount;
    }
  }

  const total = sources.reduce((sum, s) => sum + s.amount, BigInt(0));
  return {
    sources,
    total,
    requested,
    shortfall: requested > total ? requested - total : BigInt(0),
  };
};
