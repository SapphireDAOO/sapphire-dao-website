import { InvoiceType } from "./model";

// AdvancedPaymentProcessor-specific fields
export interface AdvancedInvoice extends InvoiceType {
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
  type?: "ReceivedInvoice"; // Specifies that the invoice type is "ReceivedInvoices"
  source?: "Marketplace";
}

export interface UserIssuedInvoiceInvoice extends InvoiceType {
  type?: "IssuedInvoice"; // Specifies that the invoice type is "IssuedInvoice"
  source?: "Marketplace";
}
