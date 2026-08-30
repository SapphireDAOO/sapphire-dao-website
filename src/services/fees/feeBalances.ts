// Reads unswept platform fees out of the subgraph and works out which fee
// receivers a sweep should pull from.
//
// Fees land in one-time stealth receivers (one per invoice), so the balance for
// a token is spread across many addresses, and the subgraph is the only
// practical way to enumerate them.

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
/** Safety valve so a large receiver set cannot spin the browser forever. */
const MAX_PAGES = 10;

/**
 * Message shown when the subgraph has no fee-receiver entities. The fee
 * indexing shipped after the rest of the schema, so an older deployment
 * answers with "has no field" rather than an empty list.
 */
export const FEES_NOT_INDEXED_MESSAGE =
  "This subgraph deployment does not index fee receivers yet.";

const NOT_INDEXED_PATTERN = /has no field|cannot query field|unknown (field|type)/i;

/** True when the error means the deployment predates the fee entities. */
export const isFeesNotIndexedError = (message: string): boolean =>
  NOT_INDEXED_PATTERN.test(message);

/**
 * Every (receiver, token) pair holding a non-zero balance. Pages through the
 * subgraph because there is one receiver per invoice; `truncated` reports that
 * the page cap was hit and the totals are therefore a lower bound.
 */
export const fetchFeeReceiverBalances = async (
  chainId: number,
): Promise<{ rows: FeeReceiverTokenBalanceRow[]; truncated: boolean }> => {
  const rows: FeeReceiverTokenBalanceRow[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await client(chainId)
      .query<{ feeReceiverTokenBalances: FeeReceiverTokenBalanceRow[] }>(
        FEE_RECEIVER_BALANCES_QUERY,
        { first: PAGE_SIZE, skip: page * PAGE_SIZE },
        { requestPolicy: "network-only" },
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
 * Collapses the per-receiver rows into one entry per sweep. The rows of a
 * single `sweep` call repeat its tx, token and destination and differ only in
 * amount, so they are summed into one transaction. Token and destination are
 * part of the key because one transaction can carry several sweep calls, and
 * totalling across tokens would be meaningless.
 *
 * `capped` says the query hit its row limit, in which case the oldest group may
 * have been cut in half — it is dropped rather than shown with a short total.
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

// A transaction yields one row per receiver it drained, so the row query has to
// reach well past `limit` to be sure of filling that many transactions.
const SWEEP_ROWS_PER_TRANSACTION = 10;

/** The most recent sweep transactions, newest first. */
export const fetchRecentSweeps = async (
  chainId: number,
  limit = 10,
): Promise<SweepTransaction[]> => {
  const first = limit * SWEEP_ROWS_PER_TRANSACTION;
  const result = await client(chainId)
    .query<{ feeSweeps: FeeSweepRow[] }>(
      FEE_SWEEPS_QUERY,
      { first },
      { requestPolicy: "network-only" },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);
  const rows = result.data?.feeSweeps ?? [];
  return groupSweepTransactions(rows, limit, rows.length >= first);
};

/**
 * The ERC-20 a sweep must target. Native-currency fees are wrapped before they
 * reach a receiver, so the zero address maps to the chain's WETH.
 */
export const resolveSweepToken = (
  chainId: number,
  tokenId: string,
): Address | null =>
  tokenId.toLowerCase() === ZERO_ADDRESS.toLowerCase()
    ? (WETH_CONTRACT[chainId] ?? null)
    : (tokenId as Address);

/**
 * Collapses per-receiver rows into one summary per token. Receivers are sorted
 * smallest balance first, the order `planSweep` reads them in.
 */
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

