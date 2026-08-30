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
 * Picks receivers to cover `requested`.
 *
 * A receiver that can cover the whole request on its own is used alone: every
 * extra source is another `transferFrom` in the sweep, so pulling in a second
 * address that isn't needed just costs gas. With balances of 0.5 and 50 and a
 * request of 45, the sweep takes 45 from the 50 and leaves the 0.5 untouched.
 * Of the receivers that could cover it, the smallest wins — it leaves the least
 * behind in the account it touches and keeps the larger balances whole.
 *
 * Only when no single receiver is enough does the sweep combine several, taking
 * each one's whole balance until the last, which is drawn from as far as needed
 * so the total is exact. Those are taken smallest first, which keeps the long
 * tail of dust accounts from growing without bound.
 *
 * `shortfall` is non-zero when the receivers cannot cover the request; the
 * sources returned then represent everything that is available.
 */
export const planSweep = (
  receivers: FeeReceiverBalance[],
  requested: bigint,
): SweepPlan => {
  const sources: SweepSource[] = [];

  if (requested > BigInt(0)) {
    const funded = receivers
      .filter((receiver) => receiver.balance > BigInt(0))
      .sort(compareReceivers);

    // Ascending, so the first that fits is the smallest that can.
    const single = funded.find((receiver) => receiver.balance >= requested);

    if (single) {
      sources.push({
        address: single.address,
        amount: requested,
        available: single.balance,
        drained: single.balance === requested,
      });
    } else {
      let remaining = requested;
      for (const receiver of funded) {
        if (remaining <= BigInt(0)) break;

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
  }

  const total = sources.reduce((sum, s) => sum + s.amount, BigInt(0));
  return {
    sources,
    total,
    requested,
    shortfall: requested > total ? requested - total : BigInt(0),
  };
};
