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

export const RECENT_TX_KIND_BY_EVENT = KIND_BY_EVENT;

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

const mapInvoiceEventRow = (
  chainId: number,
  row: InvoiceEventRow,
  toUsd: (tokenId: string, raw: bigint) => number,
): RecentTransaction | null => {
  const kind = KIND_BY_EVENT[row.eventType];
  const invoice = row.advancedInvoice ?? row.simpleInvoice;
  if (!kind || !invoice) return null;

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
    .query<{ invoiceEvents: InvoiceEventRow[] }>(
      RECENT_TRANSACTIONS_QUERY,
      { first },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);

  const toUsd = createUsdConverter(chainId);
  return (result.data?.invoiceEvents ?? [])
    .map((row) => mapInvoiceEventRow(chainId, row, toUsd))
    .filter((tx): tx is RecentTransaction => tx !== null);
};

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
