// Fee Paid feed: individual fee payments from the FeePaid timeseries entity
// (timestamp + token + amount only). Amounts are formatted in token units and
// converted to USD against the cached price, same as the rest of the dashboard.

import { formatUnits } from "viem";
import { getKnownPaymentToken } from "@/constants";
import { client } from "../graphql/client";
import { FEES_PAID_QUERY } from "../graphql/metricsQueries";
import { createUsdConverter } from "./subgraphMetrics";

const MICROS_PER_SECOND = 1_000_000;
const NATIVE_DECIMALS = 18;
const NATIVE_SYMBOL = "ETH";

/** A single fee payment row for the Fees Paid popup. */
export interface FeePaidRow {
  id: string;
  /** Unix seconds. */
  timestamp: number;
  /** Fee amount formatted in token units. */
  amount: string;
  /** Token symbol. */
  currency: string;
  /** USD-converted fee value. */
  amountUsd: number;
  /** Transaction hash, for the block-explorer link. */
  txHash: string;
}

interface FeePaidEventRow {
  id: string;
  timestamp: string;
  token: { id: string };
  amount: string;
  txHash: string;
}

/**
 * One page of FeePaid records since `sinceSeconds` (newest first). Fetches
 * `pageSize + 1` rows to detect whether a next page exists. FeePaid timestamps
 * are the microsecond Timestamp scalar, so the cutoff is converted to micros.
 */
export const fetchFeesPaid = async (
  chainId: number,
  page: number,
  pageSize: number,
  sinceSeconds: number,
): Promise<{ rows: FeePaidRow[]; hasNext: boolean }> => {
  const sinceMicros = (BigInt(sinceSeconds) * BigInt(MICROS_PER_SECOND)).toString();

  const result = await client(chainId)
    .query<{ feePaids: FeePaidEventRow[] }>(FEES_PAID_QUERY, {
      since: sinceMicros,
      first: pageSize + 1,
      skip: page * pageSize,
    })
    .toPromise();

  if (result.error) throw new Error(result.error.message);

  const toUsd = createUsdConverter(chainId);
  const raw = result.data?.feePaids ?? [];
  const rows = raw.slice(0, pageSize).map((r) => {
    const known = getKnownPaymentToken(chainId, r.token.id);
    const decimals = known?.decimals ?? NATIVE_DECIMALS;
    return {
      id: String(r.id),
      timestamp: Number(r.timestamp) / MICROS_PER_SECOND,
      amount: Number(formatUnits(BigInt(r.amount), decimals)).toLocaleString(
        "en-US",
        { maximumFractionDigits: 4 },
      ),
      currency: known?.name ?? NATIVE_SYMBOL,
      amountUsd: toUsd(r.token.id, BigInt(r.amount)),
      txHash: r.txHash,
    };
  });

  return { rows, hasNext: raw.length > pageSize };
};
