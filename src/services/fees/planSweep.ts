import type { FeeReceiverBalance, SweepPlan, SweepSource } from "@/model/fees";

export const compareReceivers = (
  a: FeeReceiverBalance,
  b: FeeReceiverBalance,
): number => {
  if (a.balance !== b.balance) return a.balance < b.balance ? -1 : 1;
  return a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1;
};

/**
 * A single receiver that covers the request is used alone (the
 * smallest such); otherwise whole balances are taken smallest first.
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
