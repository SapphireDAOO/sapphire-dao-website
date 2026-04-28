import type { Address } from "viem";
export type { AdminAction, AllInvoice, AllInvoicesData } from "./admin";

// Define the base Invoice type that represents an invoice's properties
// turn this into two seperate invoices for third party and in-invoices
// seperate into different files too

// Shared fields between SimplePaymentProcessor and AdvancedPaymentProcessor
// in the subgraph schema, plus UI-only fields the dashboard uses.
export type InvoiceType = {
  // Subgraph-shared fields
  id: string;
  invoiceNonce?: string;
  state?: string;
  createdAt?: string | null;
  paidAt?: string;
  releasedAt?: string;
  seller?: string;
  buyer?: string;
  price?: string | null;
  amountPaid?: string | null;
  releaseHash?: string;
  paymentTxHash?: string;
  fee?: string;
  contract?: string;
  creationTxHash?: string;
  commissionTxHash?: string;
  refundTxHash?: string;
  lastActionTime?: string;
  buyerNote?: string;
  sellerNote?: string;

  // UI-only fields
  invoiceId: bigint;
  status?: string;
  type?: "Seller" | "Buyer" | "IssuedInvoice" | "ReceivedInvoice";
  source?: string;
  holdPeriod?: string | null;
  releaseAt?: string | null;
  cancelAt?: string;
  notes?: Note[];
  note?: string;
  history?: History[];
};

// remove
export type Invoice = {
  releaseAt?: string | null;
  id: string;
  invoiceId: bigint;
  amountPaid?: string | null;
  createdAt?: string | null;
  paidAt?: string;
  releasedAt?: string;
  price?: string | null;
  status?: string;
  type?: "Seller" | "Buyer" | "IssuedInvoice" | "ReceivedInvoice";
  holdPeriod?: string | null;
  paymentTxHash?: string;
  releaseHash?: string;
  refundTxHash?: string;
  contract?: string;
  invalidateAt?: string;
  expiresAt?: string;
  fee?: string;
  buyer?: string;
  seller?: string;
  source?: string;
  paymentToken?: string;
  cancelAt?: string;
  creationTxHash?: string;
  notes?: Note[];
  note?: string;
  history?: History[];
  buyerNote?: string;
  sellerNote?: string;
  sellerAmountReceivedAfterDispute?: string | null;
  buyerAmountReceivedAfterDispute?: string | null;
  amountReleased?: string | null;
  amountRefunded?: string | null;
  disputeSettledTxHash?: string;
};

export interface History {
  status: string;
  time: string;
}

// remove
export interface Note {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
}

// used on ui
export interface InvoiceCardProps {
  invoice: Invoice;
  onAddNote?: (invoiceId: string, message: string) => void;
}

//remove
// Specialized invoice type for invoices created by the user
export interface UserCreatedInvoice extends Invoice {
  type?: "Seller"; // Specifies that the invoice type is "Seller"
  source?: "Simple";
}

//remove
// Specialized invoice type for invoices paid by the user
export interface UserPaidInvoice extends Invoice {
  type?: "Buyer"; // Specifies that the invoice type is "Buyer"
  source?: "Simple";
}

//remove
export interface UserIssuedInvoiceInvoice extends Invoice {
  type?: "IssuedInvoice"; // Specifies that the invoice type is "IssuedInvoice"
  source?: "Marketplace";
}

//remove
export interface UserReceivedInvoicesInvoice extends Invoice {
  type?: "ReceivedInvoice"; // Specifies that the invoice type is "ReceivedInvoices"
  source?: "Marketplace";
}

// Props for a Payment Card component, containing basic invoice details
export type PaymentCardProps = {
  data: {
    invoiceId: string | bigint;
  } | null;
};

// Type for mapping error keys to corresponding error messages
export type ErrorMessages = {
  [key: string]: string; // A key-value pair where the key is the error key, and the value is the corresponding error message
};

export interface TokenData {
  name: string;
  id: string;
  decimals: number;
}

export interface InvoiceDetails {
  id?: string;
  invoiceId: bigint;
  price: string;
  paymentToken?: Address;
  tokenList: TokenData[];
  status?: string;
}

export interface SmartInvoice {
  id: string;
  invoiceId: string;
  price: string;
  paymentToken: string;
  amountPaid?: string;
  cancelAt?: string;
  contract?: string;
  createdAt?: string;
  escrow?: string;
  expiresAt?: string;
  paidAt?: string;
  releasedAt?: string;
  state?: string;
}

// remove
export interface MetaInvoice {
  id: string;
  invoiceId: string;
  price: string;
  contract?: string;
  paymentToken?: string;
}
