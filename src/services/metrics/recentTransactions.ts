// Recent Transactions feed: the latest settlement-type InvoiceEvents across both
// processors, with the displayed amount read from the linked invoice. The simple
// processor is native-ETH denominated; the advanced processor carries a
// PaymentToken (name + decimals) used to format and label the amount.

import { formatUnits } from "viem";
import { getKnownPaymentToken } from "@/constants";
import type { RecentTransaction, TransactionKind } from "./types";
import { client } from "../graphql/client";
import { RECENT_TRANSACTIONS_QUERY } from "../graphql/metricsQueries";

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

interface AdvancedInvoiceRef extends InvoiceRef {
  paymentToken: { id: string; name: string | null; decimal: number | null } | null;
}

interface InvoiceEventRow {
  id: string;
  eventType: string;
  txHash: string;
  timestamp: string;
  simpleInvoice: InvoiceRef | null;
  advancedInvoice: AdvancedInvoiceRef | null;
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

export const fetchRecentTransactions = async (
  chainId: number,
  first = 5,
): Promise<RecentTransaction[]> => {
  const result = await client(chainId)
    .query<{ invoiceEvents: InvoiceEventRow[] }>(RECENT_TRANSACTIONS_QUERY, {
      first,
    })
    .toPromise();

  if (result.error) throw new Error(result.error.message);

  const out: RecentTransaction[] = [];
  for (const row of result.data?.invoiceEvents ?? []) {
    const kind = KIND_BY_EVENT[row.eventType];
    const invoice = row.advancedInvoice ?? row.simpleInvoice;
    if (!kind || !invoice) continue;

    // Advanced invoices carry a PaymentToken; simple invoices are native ETH.
    let decimals = NATIVE_DECIMALS;
    let currency = NATIVE_SYMBOL;
    const token = row.advancedInvoice?.paymentToken;
    if (token) {
      const known = getKnownPaymentToken(chainId, token.id);
      decimals = token.decimal ?? known?.decimals ?? NATIVE_DECIMALS;
      currency = token.name ?? known?.name ?? NATIVE_SYMBOL;
    }

    out.push({
      id: row.id,
      kind,
      source: row.advancedInvoice ? "Marketplace" : "Simple",
      invoiceNonce: invoice.invoiceNonce,
      txHash: row.txHash,
      timestamp: Number(row.timestamp),
      amount: formatTokenAmount(invoice.amountPaid ?? invoice.price ?? "0", decimals),
      currency,
      counterparty: invoice.buyer?.id ?? invoice.seller?.id ?? undefined,
    });
  }

  return out;
};
