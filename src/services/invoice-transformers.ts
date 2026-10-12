import { formatEther } from "viem";
import { Invoice } from "@/model/model";
import { unixToGMT } from "@/utils";
import {
  sortState,
  sortHistory,
  synthesizeIntermediatedHistory,
  flattenInvoiceEvents,
} from "@/lib/invoiceHistory";
import {
  getContractInvoiceIdBigInt,
  getDisplayInvoiceIdString,
} from "@/lib/invoiceIdentifiers";
import { ZERO_ADDRESS } from "@/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawInvoice = any;

export const transformSimple = (
  raw: RawInvoice,
  type: "Seller" | "Buyer"
): Invoice => {
  const inv = flattenInvoiceEvents(raw);
  return {
  id: getDisplayInvoiceIdString(inv),
  invoiceId: getContractInvoiceIdBigInt(inv),
  createdAt: inv.createdAt ? unixToGMT(inv.createdAt) : null,
  paidAt: inv.paidAt || "Not Paid",
  status: sortState(inv.state, inv.expiresAt),
  price: inv.price ? formatEther(BigInt(inv.price)) : null,
  amountPaid: inv.amountPaid ? formatEther(BigInt(inv.amountPaid)) : null,
  type,
  contract: inv.contract,
  paymentTxHash: inv.paymentTxHash,
  expiresAt: inv.expiresAt,
  sellerActionDeadline: inv.sellerActionDeadline,
  seller: inv.seller?.id ?? "",
  buyer: inv.buyer?.id ?? "",
  releaseHash: inv.releaseHash,
  releaseAt: inv.releasedAt,
  source: "Simple" as const,
  history: sortHistory(inv.history, inv.historyTime),
  refundTxHash: inv.refundTxHash,
  };
};

export const transformIntermediated = (
  raw: RawInvoice,
  type: "IssuedInvoice" | "ReceivedInvoice"
): Invoice => {
  const inv = flattenInvoiceEvents(raw);
  const history = synthesizeIntermediatedHistory(inv);

  return {
    id: getDisplayInvoiceIdString(inv),
    invoiceId: getContractInvoiceIdBigInt(inv),
    createdAt: inv.createdAt ? unixToGMT(inv.createdAt) : null,
    paidAt: inv.paidAt || "Not Paid",
    status: sortState(inv.state),
    price: inv.price ?? null,
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
    expiresAt: inv.expiresAt,
    source: "Intermediated" as const,
    // ETH payments have no PaymentToken entity.
    paymentToken: inv.paymentToken?.id ?? ZERO_ADDRESS,
    refundTxHash: inv.refundTxHash,
    history,
  };
};
