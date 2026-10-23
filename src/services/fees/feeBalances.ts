import type { Address } from "viem";
import {
  getKnownPaymentToken,
  WETH_CONTRACT,
  ZERO_ADDRESS,
} from "@/constants";
import type {
  FeeReceiverTokenBalanceRow,
  FeeSweepRow,
  SweepTransaction,
  TokenFeeSummary,
} from "@/model/fees";
import { compareReceivers } from "./planSweep";
import { client } from "../graphql/client";
import {
  FEE_RECEIVER_BALANCES_QUERY,
  FEE_SWEEPS_QUERY,
} from "../graphql/feeQueries";
import { throwSubgraphError } from "../metrics/errors";

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

/**
 * The fee entities shipped after the rest of the schema,
 * so an older deployment answers "has no field".
 */
export const FEES_NOT_INDEXED_MESSAGE =
  "This subgraph deployment does not index fee receivers yet.";

const NOT_INDEXED_PATTERN = /has no field|cannot query field|unknown (field|type)/i;

export const isFeesNotIndexedError = (message: string): boolean =>
  NOT_INDEXED_PATTERN.test(message);

export const fetchFeeReceiverBalances = async (
  chainId: number,
): Promise<{ rows: FeeReceiverTokenBalanceRow[]; truncated: boolean }> => {
  const rows: FeeReceiverTokenBalanceRow[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await client(chainId)
      .query<{ feeReceiverTokenBalances: FeeReceiverTokenBalanceRow[] }>(
        FEE_RECEIVER_BALANCES_QUERY,
        { first: PAGE_SIZE, skip: page * PAGE_SIZE },
      )
      .toPromise();

    if (result.error) throwSubgraphError(result.error);

    const batch = result.data?.feeReceiverTokenBalances ?? [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }

  return { rows, truncated: true };
};

/**
 * One entry per sweep call. A `capped` result may have
 * cut the oldest group short, so that one is dropped.
 */
export const groupSweepTransactions = (
  rows: FeeSweepRow[],
  limit: number,
  capped: boolean,
): SweepTransaction[] => {
  const byTransaction = new Map<string, SweepTransaction>();

  for (const row of rows) {
    const id = `${row.txHash}:${row.token.id.toLowerCase()}:${row.destination.toLowerCase()}`;
    const existing = byTransaction.get(id);

    if (existing) {
      existing.amount += BigInt(row.amount);
      existing.receiverCount += 1;
      continue;
    }

    byTransaction.set(id, {
      id,
      txHash: row.txHash,
      timestamp: row.timestamp,
      destination: row.destination,
      token: row.token,
      amount: BigInt(row.amount),
      receiverCount: 1,
    });
  }

  const transactions = [...byTransaction.values()];
  if (capped && transactions.length > 1) transactions.pop();
  return transactions.slice(0, limit);
};

const SWEEP_ROWS_PER_TRANSACTION = 10;

export const fetchRecentSweeps = async (
  chainId: number,
  limit = 10,
): Promise<SweepTransaction[]> => {
  const first = limit * SWEEP_ROWS_PER_TRANSACTION;
  const result = await client(chainId)
    .query<{ feeSweeps: FeeSweepRow[] }>(
      FEE_SWEEPS_QUERY,
      { first },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);
  const rows = result.data?.feeSweeps ?? [];
  return groupSweepTransactions(rows, limit, rows.length >= first);
};

export const resolveSweepToken = (
  chainId: number,
  tokenId: string,
): Address | null =>
  tokenId.toLowerCase() === ZERO_ADDRESS.toLowerCase()
    ? (WETH_CONTRACT[chainId] ?? null)
    : (tokenId as Address);

export const summarizeFeesByToken = (
  chainId: number,
  rows: FeeReceiverTokenBalanceRow[],
): TokenFeeSummary[] => {
  const byToken = new Map<string, TokenFeeSummary>();

  for (const row of rows) {
    const tokenId = row.token.id.toLowerCase();
    const balance = BigInt(row.balance);
    if (balance <= BigInt(0)) continue;

    let summary = byToken.get(tokenId);
    if (!summary) {
      const known = getKnownPaymentToken(chainId, tokenId);
      const sweepToken = resolveSweepToken(chainId, tokenId);
      if (!sweepToken) continue;

      summary = {
        tokenId,
        sweepToken,
        symbol: known?.name ?? row.token.name ?? "Unknown",
        decimals: known?.decimals ?? row.token.decimal ?? 18,
        accrued: BigInt(0),
        swept: BigInt(0),
        balance: BigInt(0),
        receiverCount: 0,
        receivers: [],
      };
      byToken.set(tokenId, summary);
    }

    summary.accrued += BigInt(row.accrued);
    summary.swept += BigInt(row.swept);
    summary.balance += balance;
    summary.receiverCount += 1;
    summary.receivers.push({
      address: row.feeReceiver.address as Address,
      balance,
      updatedAt: Number(row.updatedAt),
    });
  }

  const summaries = [...byToken.values()];
  for (const summary of summaries) summary.receivers.sort(compareReceivers);
  return summaries.sort((a, b) => a.symbol.localeCompare(b.symbol));
};

