import { InvoiceType } from "./model";

export interface SimpleInvoice extends InvoiceType {
  expiresAt?: string;
  sellerActionDeadline?: string;
}

