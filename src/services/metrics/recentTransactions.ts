// Recent Transactions feed: the latest settlement-type InvoiceEvents across both
// processors, with the displayed amount read from the linked invoice. The simple
// processor is native-ETH denominated; the intermediated processor carries a
// PaymentToken (name + decimals) used to format and label the amount.

import { formatUnits } from "viem";
import { getKnownPaymentToken, ZERO_ADDRESS } from "@/constants";
import type { RecentTransaction, TransactionKind } from "./types";
import { createUsdConverter } from "./subgraphMetrics";
import { throwSubgraphError } from "./errors";
import { client } from "../graphql/client";
import {
  RECENT_TRANSACTIONS_QUERY,
  PAID_TRANSACTIONS_QUERY,
  ESCROW_TRANSACTIONS_QUERY,
} from "../graphql/metricsQueries";

interface UserRef {
  id: string;
}

interface InvoiceRef {
  invoiceNonce: string;
  price: string | null;
  amountPaid: string | null;
  buyer: UserRef | null;
  seller: UserRef | null;
}

interface IntermediatedInvoiceRef extends InvoiceRef {
  paymentToken: { id: string; name: string | null; decimal: number | null } | null;
}

interface InvoiceEventRow {
  id: string;
  eventType: string;
  txHash: string;
  timestamp: string;
  simpleInvoice: InvoiceRef | null;
  advancedInvoice: IntermediatedInvoiceRef | null;
}

const KIND_BY_EVENT: Record<string, TransactionKind> = {
  INVOICE_PAID: "paid",
  INVOICE_REFUNDED: "refunded",
  REFUNDED: "refunded",
  INVOICE_RELEASED: "released",
  PAYMENT_RELEASED: "released",
  DISPUTE_SETTLED: "settled",
};

const NATIVE_DECIMALS = 18;
const NATIVE_SYMBOL = "ETH";

const formatTokenAmount = (raw: string, decimals: number): string =>
  Number(formatUnits(BigInt(raw), decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });

/** Settlement-type events surfaced in the feed, keyed by PaymentProcessorEventType. */
export const RECENT_TX_KIND_BY_EVENT = KIND_BY_EVENT;

/**
 * Format a raw token amount for display, resolving decimals + symbol from the
 * known-token list. The zero address (or an unknown token) falls back to native
 * ETH. Shared with the live socket so live rows match polled rows.
 */
export const formatTokenDisplay = (
  chainId: number,
  tokenId: string,
  raw: bigint,
): { amount: string; currency: string } => {
  const known = getKnownPaymentToken(chainId, tokenId);
  return {
    amount: formatTokenAmount(raw.toString(), known?.decimals ?? NATIVE_DECIMALS),
    currency: known?.name ?? NATIVE_SYMBOL,
  };
};

/** Map a raw InvoiceEvent row to a display transaction, or null if unsupported. */
const mapInvoiceEventRow = (
  chainId: number,
  row: InvoiceEventRow,
  toUsd: (tokenId: string, raw: bigint) => number,
): RecentTransaction | null => {
  const kind = KIND_BY_EVENT[row.eventType];
  const invoice = row.advancedInvoice ?? row.simpleInvoice;
  if (!kind || !invoice) return null;

  // Intermediated invoices carry a PaymentToken; simple invoices are native ETH.
  let decimals = NATIVE_DECIMALS;
  let currency = NATIVE_SYMBOL;
  let tokenId = ZERO_ADDRESS as string;
  const token = row.advancedInvoice?.paymentToken;
  if (token) {
    const known = getKnownPaymentToken(chainId, token.id);
    decimals = token.decimal ?? known?.decimals ?? NATIVE_DECIMALS;
    currency = token.name ?? known?.name ?? NATIVE_SYMBOL;
    tokenId = token.id;
  }

  const rawAmount = invoice.amountPaid ?? invoice.price ?? "0";

  return {
    id: row.id,
    kind,
    source: row.advancedInvoice ? "Intermediated" : "Simple",
    invoiceNonce: invoice.invoiceNonce,
    txHash: row.txHash,
    timestamp: Number(row.timestamp),
    amount: formatTokenAmount(rawAmount, decimals),
    currency,
    amountUsd: toUsd(tokenId, BigInt(rawAmount)),
    counterparty: invoice.buyer?.id ?? invoice.seller?.id ?? undefined,
  };
};

export const fetchRecentTransactions = async (
  chainId: number,
  first = 5,
): Promise<RecentTransaction[]> => {
  const result = await client(chainId)
    // network-only: react-query owns caching for this fetcher; cache-first
    // would turn its refetches into stale no-ops.
    .query<{ invoiceEvents: InvoiceEventRow[] }>(
      RECENT_TRANSACTIONS_QUERY,
      { first },
      { requestPolicy: "network-only" },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);

  const toUsd = createUsdConverter(chainId);
  return (result.data?.invoiceEvents ?? [])
    .map((row) => mapInvoiceEventRow(chainId, row, toUsd))
    .filter((tx): tx is RecentTransaction => tx !== null);
};

/**
 * One page of `query`'s invoice events since `sinceSeconds` (newest first).
 * Fetches `pageSize + 1` rows to detect whether a next page exists.
 */
const fetchPaginatedEvents = async (
  query: string,
  chainId: number,
  page: number,
  pageSize: number,
  sinceSeconds: number,
): Promise<{ rows: RecentTransaction[]; hasNext: boolean }> => {
  const result = await client(chainId)
    .query<{ invoiceEvents: InvoiceEventRow[] }>(
      query,
      {
        since: sinceSeconds.toString(),
        first: pageSize + 1,
        skip: page * pageSize,
      },
      { requestPolicy: "network-only" },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);

  const toUsd = createUsdConverter(chainId);
  const raw = result.data?.invoiceEvents ?? [];
  const rows = raw
    .slice(0, pageSize)
    .map((row) => mapInvoiceEventRow(chainId, row, toUsd))
    .filter((tx): tx is RecentTransaction => tx !== null);

  return { rows, hasNext: raw.length > pageSize };
};

/** One page of INVOICE_PAID transactions since `sinceSeconds`. */
export const fetchPaidTransactions = (
  chainId: number,
  page: number,
  pageSize: number,
  sinceSeconds: number,
) =>
  fetchPaginatedEvents(
    PAID_TRANSACTIONS_QUERY,
    chainId,
    page,
    pageSize,
    sinceSeconds,
  );

/** One page of escrow-moving events (paid in / released-refunded-settled out). */
export const fetchEscrowTransactions = (
  chainId: number,
  page: number,
  pageSize: number,
  sinceSeconds: number,
) =>
  fetchPaginatedEvents(
    ESCROW_TRANSACTIONS_QUERY,
    chainId,
    page,
    pageSize,
    sinceSeconds,
  );
