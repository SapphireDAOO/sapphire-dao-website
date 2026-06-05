import type { GasStats } from "./types";
import { client } from "../graphql/client";
import { GAS_TRACKER_QUERY } from "../graphql/metricsQueries";

interface GasPaidRow {
  amount: string;
  transactionCount: string;
  lastTimeStamp: string;
}

export const fetchGasStats = async (
  chainId: number,
): Promise<GasStats | null> => {
  const result = await client(chainId)
    .query<{ gasPaid: GasPaidRow | null }>(GAS_TRACKER_QUERY, {})
    .toPromise();

  if (result.error) throw new Error(result.error.message);

  const row = result.data?.gasPaid;
  if (!row) return null;

  return {
    totalGasWei: BigInt(row.amount),
    transactionCount: Number(row.transactionCount),
    lastTimestamp: Number(row.lastTimeStamp),
  };
};
