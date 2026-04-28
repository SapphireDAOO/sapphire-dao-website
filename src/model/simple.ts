import { InvoiceType } from "./model";

// SimplePaymentProcessor-specific fields
export interface SimpleInvoice extends InvoiceType {
  invalidateAt?: string;
  expiresAt?: string;
}

