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

/** The most recent sweeps, newest first. */
export const fetchRecentSweeps = async (
  chainId: number,
  first = 10,
): Promise<FeeSweepRow[]> => {
  const result = await client(chainId)
    .query<{ feeSweeps: FeeSweepRow[] }>(
      FEE_SWEEPS_QUERY,
      { first },
      { requestPolicy: "network-only" },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);
  return result.data?.feeSweeps ?? [];
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
 * smallest balance first, which is the order `planSweep` draws from.
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

