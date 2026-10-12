import { InvoiceType } from "./model";

export interface IntermediatedInvoice extends InvoiceType {
  escrow?: string;
  balance?: string;
  paymentToken?: string;
  disputeSettledTxHash?: string;
  amountReleased?: string | null;
  amountRefunded?: string | null;
  sellerAmountReceivedAfterDispute?: string | null;
  buyerAmountReceivedAfterDispute?: string | null;
}

export interface MetaInvoice {
  id: string;
  invoiceId: string;
  price: string;
  contract?: string;
  paymentToken?: string;
}


export interface UserReceivedInvoicesInvoice extends InvoiceType {
  type?: "ReceivedInvoice";
  source?: "Intermediated";
}

export interface UserIssuedInvoiceInvoice extends InvoiceType {
  type?: "IssuedInvoice";
  source?: "Intermediated";
}
