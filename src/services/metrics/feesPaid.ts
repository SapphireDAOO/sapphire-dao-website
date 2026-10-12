import { formatUnits } from "viem";
import { getKnownPaymentToken } from "@/constants";
import { client } from "../graphql/client";
import { FEES_PAID_QUERY } from "../graphql/metricsQueries";
import { createUsdConverter } from "./subgraphMetrics";
import { throwSubgraphError } from "./errors";

const MICROS_PER_SECOND = 1_000_000;
const NATIVE_DECIMALS = 18;
const NATIVE_SYMBOL = "ETH";

export interface FeePaidRow {
  id: string;
  timestamp: number;
  amount: string;
  currency: string;
  amountUsd: number;
  txHash: string;
}

interface FeePaidEventRow {
  id: string;
  timestamp: string;
  token: { id: string };
  amount: string;
  txHash: string;
}

export const fetchFeesPaid = async (
  chainId: number,
  page: number,
  pageSize: number,
  sinceSeconds: number,
): Promise<{ rows: FeePaidRow[]; hasNext: boolean }> => {
  const sinceMicros = (BigInt(sinceSeconds) * BigInt(MICROS_PER_SECOND)).toString();

  const result = await client(chainId)
    .query<{ feePaids: FeePaidEventRow[] }>(
      FEES_PAID_QUERY,
      {
        since: sinceMicros,
        first: pageSize + 1,
        skip: page * pageSize,
      },
      { requestPolicy: "network-only" },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);

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
