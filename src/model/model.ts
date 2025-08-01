import type { Address } from "viem";

// Define the base Invoice type that represents an invoice's properties
export type Invoice = {
  releaseAt?: string | null;
  id: string;
  invoiceKey: Address;
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
  contract?: string;
  fee?: string;
  buyer?: string;
  seller?: string;
  source?: string;
  paymentToken?: string;
  cancelAt?: string;
  creationTxHash?: string;
};

export type AllInvoice = {
  id: string;
  invoiceKey: Address;
  contract: string;
  seller: string;
  createdAt: string;
  payment: string;
  paidAt: string;
  by: string;
  state: string;
  release: string;
  fee: string;
  releaseHash: string;
  status: string;
  creationTxHash: string;
};

export type AdminAction = {
  id: string;
  invoiceKey: Address;
  action: string;
  time: string;
  type: "Single Invoice" | "Meta Invoice";
  txHash: string;
  balance: string;
};

export type AllInvoicesData = {
  invoices: AllInvoice[];
  actions: AdminAction[];
  marketplaceInvoices: AllInvoice[];
};

// Specialized invoice type for invoices created by the user
export interface UserCreatedInvoice extends Invoice {
  type?: "Seller"; // Specifies that the invoice type is "Seller"
  source?: "Simple";
}

// Specialized invoice type for invoices paid by the user
export interface UserPaidInvoice extends Invoice {
  type?: "Buyer"; // Specifies that the invoice type is "Buyer"
  source?: "Simple";
}

export interface UserIssuedInvoiceInvoice extends Invoice {
  type?: "IssuedInvoice"; // Specifies that the invoice type is "IssuedInvoice"
  source?: "Marketplace";
}

export interface UserReceivedInvoicesInvoice extends Invoice {
  type?: "ReceivedInvoice"; // Specifies that the invoice type is "ReceivedInvoices"
  source?: "Marketplace";
}

// Props for a Payment Card component, containing basic invoice details
export type PaymentCardProps = {
  data: {
    id: string; // Unique identifier for the invoice
    invoiceKey: Address; // Invoicekey associated with the invoice
    price: string; // Price associated with the invoice
    status: string; // Status of the invoice (e.g., "paid", "created", "unpaid")
  };
};

// Type for mapping error keys to corresponding error messages
export type ErrorMessages = {
  [key: string]: string; // A key-value pair where the key is the error key, and the value is the corresponding error message
};

export interface TokenData {
  name: string;
  id: Address;
  decimals: number;
}
export interface InvoiceDetails {
  id?: string;
  invoiceKey: Address;
  price: string;
  paymentToken?: Address;
  tokenList: TokenData[];
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

export interface MetaInvoice {
  id: string;
  invoiceId: string;
  price: string;
  contract?: string;
  paymentToken?: string;
}
