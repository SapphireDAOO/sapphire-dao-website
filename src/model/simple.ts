import { InvoiceType } from "./model";

// SimplePaymentProcessor-specific fields
export interface SimpleInvoice extends InvoiceType {
  expiresAt?: string;
  sellerActionDeadline?: string;
}

