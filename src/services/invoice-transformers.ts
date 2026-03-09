import { formatEther } from "viem";
import { Invoice } from "@/model/model";
import { unixToGMT } from "@/utils";
import { sortState, sortHistory, synthesizeMarketplaceHistory } from "@/lib/invoiceHistory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawInvoice = any;

/** Transform a raw simple-payment-processor invoice from the subgraph */
export const transformSimple = (
  inv: RawInvoice,
  type: "Seller" | "Buyer"
): Invoice => ({
  id: inv.invoiceId ?? inv.invoiceNonce ?? inv.id,
  orderId: inv.id,
  createdAt: inv.createdAt ? unixToGMT(inv.createdAt) : null,
  paidAt: inv.paidAt || "Not Paid",
  status: sortState(inv.state, inv.invalidateAt),
  price: inv.price ? formatEther(BigInt(inv.price)) : null,
  amountPaid: inv.amountPaid ? formatEther(BigInt(inv.amountPaid)) : null,
  type,
  contract: inv.contract,
  paymentTxHash: inv.paymentTxHash,
  invalidateAt: inv.invalidateAt,
  expiresAt: inv.expiresAt,
  seller: inv.seller?.id ?? "",
  buyer: inv.buyer?.id ?? "",
  releaseHash: inv.releaseHash,
  releaseAt: inv.releasedAt,
  source: "Simple" as const,
  history: sortHistory(inv.history, inv.historyTime),
  refundTxHash: inv.refundTxHash,
});

/** Transform a raw advanced-payment-processor (marketplace) invoice from the subgraph */
export const transformMarketplace = (
  inv: RawInvoice,
  type: "IssuedInvoice" | "ReceivedInvoice"
): Invoice => {
  const history = synthesizeMarketplaceHistory(inv);

  return {
    id: inv.invoiceId ?? inv.invoiceNonce ?? inv.id,
    orderId: inv.id,
    createdAt: inv.createdAt ? unixToGMT(inv.createdAt) : null,
    paidAt: inv.paidAt || "Not Paid",
    status: sortState(inv.state),
    price: inv.price ?? null,
    // Pass raw bigint/string so the component can format with correct token decimals
    amountPaid: inv.amountPaid != null ? String(inv.amountPaid) : null,
    amountReleased: inv.amountReleased != null ? String(inv.amountReleased) : null,
    amountRefunded: inv.amountRefunded != null ? String(inv.amountRefunded) : null,
    disputeSettledTxHash: inv.disputeSettledTxHash ?? undefined,
    sellerAmountReceivedAfterDispute: inv.sellerAmountReceivedAfterDispute ?? null,
    buyerAmountReceivedAfterDispute: inv.buyerAmountReceivedAfterDispute ?? null,
    type,
    contract: inv.contract,
    paymentTxHash: inv.paymentTxHash,
    releaseHash: inv.releaseHash,
    seller: inv.seller?.id ?? "",
    buyer: inv.buyer?.id ?? "",
    releaseAt: inv.releasedAt,
    invalidateAt: inv.invalidateAt,
    expiresAt: inv.expiresAt,
    source: "Marketplace" as const,
    paymentToken: inv.paymentToken?.id ?? "",
    refundTxHash: inv.refundTxHash,
    history,
  };
};
